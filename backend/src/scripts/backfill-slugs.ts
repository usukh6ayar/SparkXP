/**
 * One-off backfill: populate Word.slug for rows created before the column
 * existed. Run once after deploying the vocabulary-system entity changes:
 *   npm run backfill-slugs
 *
 * Idempotent — only fills rows where slug IS NULL, so it's safe to re-run.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource, IsNull } from 'typeorm';
import { entities } from '../entities';
import { Word } from '../entities/word.entity';
import { slugify } from '../words/words.service';

async function main() {
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

  const rows = await wordRepo.find({ where: { slug: IsNull() } });
  console.log(`📂 slug дутуу ${rows.length} үг олдлоо.\n`);

  let updated = 0;
  const BATCH = 100;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (w) => {
        w.slug = slugify(w.english);
        await wordRepo.save(w);
        updated++;
      }),
    );
    process.stdout.write(`\r  Шинэчилсэн: ${updated} / ${rows.length}`);
  }

  await ds.destroy();
  console.log(`\n\n✅ Дууслаа! slug бөглөсөн: ${updated}`);
}

main().catch((err) => {
  console.error('❌ Алдаа:', err.message);
  process.exit(1);
});
