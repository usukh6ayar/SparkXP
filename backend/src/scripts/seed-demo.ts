/**
 * Demo seed — one example record per student-facing content feature, for local
 * development. Complements `npm run seed` (which seeds plans / admin / words /
 * quiz). Run AFTER the base seed:
 *
 *   npm run seed          # plans, admin, sample words + quiz
 *   npm run seed:demo     # 1 lesson + 1 reading passage per CEFR level
 *
 * Safe to run repeatedly — skips records that already exist (matched by title).
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { entities } from '../entities';
import { Lesson } from '../entities/lesson.entity';
import { ReadingPassage } from '../entities/reading-passage.entity';
import { LessonType, ContentLevel } from '../common/enums';

// ── Lessons: one island per level (mobile "Хичээлийн ертөнц" map) ──────────────
interface IslandDef {
  level: ContentLevel;
  island: string;
  title: string;
  description: string;
  type: LessonType;
  xp: number;
  minutes: number;
}

const ISLANDS: IslandDef[] = [
  { level: ContentLevel.A1, island: 'Forest', title: 'Forest — Мэндчилгээ ба танилцах', description: 'Анхан шатны мэндчилгээний үгс ба өгүүлбэр.', type: LessonType.VOCABULARY, xp: 20, minutes: 5 },
  { level: ContentLevel.A2, island: 'Village', title: 'Village — Өдөр тутмын амьдрал', description: 'Тосгоны амьдрал, өдөр тутмын үйлдлүүдийг сонсож ойлгох.', type: LessonType.LISTENING, xp: 30, minutes: 7 },
  { level: ContentLevel.B1, island: 'Castle', title: 'Castle — Унших чадвар', description: 'Богино өгүүллэг уншиж ойлгох дасгал.', type: LessonType.READING, xp: 40, minutes: 8 },
  { level: ContentLevel.B2, island: 'Mountain', title: 'Mountain — Зай нөхөх', description: 'Дунд шатны зай нөхөх дүрмийн дасгал.', type: LessonType.FILL, xp: 50, minutes: 9 },
  { level: ContentLevel.C1, island: 'Space', title: 'Space — Бичих чадвар', description: 'Хийсвэр сэдвээр эссэ бичих дасгал.', type: LessonType.WRITING, xp: 60, minutes: 10 },
  { level: ContentLevel.C2, island: 'Sky Realm', title: 'Sky Realm — Дүрмийн нарийвчлал', description: 'Дээд шатны өгүүлбэрзүй ба хэлзүйн дүрэм.', type: LessonType.GRAMMAR, xp: 80, minutes: 12 },
];

// ── Reading passages: one short text per level ────────────────────────────────
interface PassageDef {
  level: ContentLevel;
  title: string;
  sentences: string[];
}

const PASSAGES: PassageDef[] = [
  { level: ContentLevel.A1, title: 'My Day', sentences: ['I wake up at seven.', 'I eat breakfast with my family.', 'Then I go to school by bus.'] },
  { level: ContentLevel.A2, title: 'A Trip to the Village', sentences: ['Last weekend we visited a small village.', 'The houses had red roofs and big gardens.', 'We bought fresh bread and talked to the people there.'] },
  { level: ContentLevel.B1, title: 'The Old Castle', sentences: ['The castle stood on a green hill for hundreds of years.', 'Many travellers came to see its tall towers and red flags.', 'Inside, the walls told stories of kings and brave knights.'] },
  { level: ContentLevel.B2, title: 'Climbing the Mountain', sentences: ['Reaching the top of the mountain was not easy.', 'The path was steep and the weather changed quickly.', 'But the view from the summit made every step worth it.'] },
  { level: ContentLevel.C1, title: 'Journey into Space', sentences: ['Space exploration has always pushed the limits of human curiosity.', 'Each mission teaches us something new about distant worlds.', 'Yet the greatest discoveries often raise even deeper questions.'] },
  { level: ContentLevel.C2, title: 'The Sky Realm', sentences: ['Suspended among the clouds, the ancient realm defied every law of nature.', 'Scholars argued endlessly about whether it was myth or forgotten history.', 'Its golden spires, however, remained indifferent to such debates.'] },
];

async function seedDemo(ds: DataSource) {
  // Lessons
  const lessonRepo = ds.getRepository(Lesson);
  let lessons = 0;
  for (let i = 0; i < ISLANDS.length; i++) {
    const def = ISLANDS[i];
    if (await lessonRepo.findOne({ where: { title: def.title } })) {
      console.log(`— Lesson ${def.level.toUpperCase()} ${def.island}: exists, skip`);
      continue;
    }
    await lessonRepo.save(
      lessonRepo.create({
        title: def.title,
        description: def.description,
        type: def.type,
        level: def.level,
        content: { island: def.island, xp: def.xp, minutes: def.minutes },
        position: i + 1,
        isPublished: true,
        priceSparks: 0,
      }),
    );
    lessons++;
    console.log(`✅ Lesson ${def.level.toUpperCase()} ${def.island}`);
  }

  // Reading passages
  const readingRepo = ds.getRepository(ReadingPassage);
  let passages = 0;
  for (const def of PASSAGES) {
    if (await readingRepo.findOne({ where: { title: def.title } })) {
      console.log(`— Reading "${def.title}": exists, skip`);
      continue;
    }
    const wordCount = def.sentences.reduce((n, s) => n + s.split(/\s+/).filter(Boolean).length, 0);
    await readingRepo.save(
      readingRepo.create({
        title: def.title,
        cefr: def.level,
        wordCount,
        estimatedReadingTime: Math.max(30, Math.round((wordCount / 200) * 60)),
        coverImageUrl: null,
        keyVocab: [],
        sentences: def.sentences.map((text, index) => ({ index, text, audioUrl: null })),
        isPublished: true,
      }),
    );
    passages++;
    console.log(`✅ Reading ${def.level.toUpperCase()} "${def.title}"`);
  }

  console.log(`\n${lessons} lesson(s) + ${passages} reading passage(s) created.`);
}

async function main() {
  console.log('🌱 Seeding demo content (lessons + reading)...\n');
  const ssl = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;
  const ds = new DataSource(
    process.env.DATABASE_URL
      ? { type: 'postgres', url: process.env.DATABASE_URL, entities, synchronize: true, ssl }
      : {
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          username: process.env.DB_USERNAME ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME ?? 'englishxp',
          entities,
          synchronize: true,
          ssl,
        },
  );
  await ds.initialize();
  try {
    await seedDemo(ds);
    console.log('\n✅ Demo seed complete.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Demo seed failed:', err);
  process.exit(1);
});
