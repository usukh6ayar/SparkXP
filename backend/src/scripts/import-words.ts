/**
 * Import words from a JSON file into the database.
 * Usage:
 *   npm run import-words                        ← uses words-seed.json (starter pack)
 *   npm run import-words -- path/to/words.json  ← custom file
 *
 * JSON format:
 *   { "words": [ { "english": "apple", "mongolian": "алим", "level": "a1", ... } ] }
 *   or just an array: [ { ... }, ... ]
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { entities } from '../entities';
import { Word } from '../entities/word.entity';
import { ContentLevel } from '../common/enums';

async function main() {
  const filePath = process.argv[2] ?? join(__dirname, 'words-seed.json');
  console.log(`📂 Файл уншиж байна: ${filePath}\n`);

  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
  const items: any[] = Array.isArray(raw) ? raw : raw.words;

  if (!Array.isArray(items) || items.length === 0) {
    console.error('❌ JSON дотор "words" массив байхгүй байна');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'englishxp',
    entities,
    synchronize: false,
  });

  await ds.initialize();
  const wordRepo = ds.getRepository(Word);

  let inserted = 0;
  let skipped = 0;
  const BATCH = 50;

  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (item) => {
        if (!item.english || !item.mongolian) { skipped++; return; }
        const level = (item.level ?? 'a1') as ContentLevel;
        const exists = await wordRepo.findOne({
          where: { english: item.english, level },
          select: { id: true },
        });
        if (exists) { skipped++; return; }
        await wordRepo.save(wordRepo.create({
          english: item.english,
          mongolian: item.mongolian,
          partOfSpeech: item.partOfSpeech ?? null,
          exampleSentence: item.exampleSentence ?? null,
          exampleTranslation: item.exampleTranslation ?? null,
          level,
          lessonId: null,
        }));
        inserted++;
      }),
    );

    if ((i / BATCH) % 10 === 0) {
      process.stdout.write(`\r  Нэмэгдсэн: ${inserted} | Алгасагдсан: ${skipped} / ${Math.min(i + BATCH, items.length)}`);
    }
  }

  await ds.destroy();
  console.log(`\n\n✅ Дууслаа! Нэмэгдсэн: ${inserted} | Давхардал алгасагдсан: ${skipped}`);
}

main().catch((err) => {
  console.error('❌ Алдаа:', err.message);
  process.exit(1);
});
