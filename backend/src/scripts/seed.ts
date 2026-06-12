/**
 * Seed script — inserts sample data for local development and testing.
 * Run with:  npm run seed
 *
 * Safe to run multiple times — checks for existing records before inserting.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { entities } from '../entities';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { Word } from '../entities/word.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { UserRole, LessonType, ContentLevel } from '../common/enums';
import { readFileSync } from 'fs';
import { join } from 'path';

async function seed(ds: DataSource) {
  // ── Subscription plans ──────────────────────────────────────────────────────
  const planRepo = ds.getRepository(Plan);
  const planDefs = [
    {
      slug: 'standard',
      name: 'Standard',
      priceAmount: 34000,
      durationDays: 30,
      features: ['Бүх үндсэн хичээл', 'Өдрийн 20 AI мессеж', 'XP & Sparks'],
      voiceMinutesLimit: 25,
      sttMinutesLimit: null,
      dictionaryAiLimit: 300,
      aiTextTokensLimit: null,
      memoryMbLimit: 100,
    },
    {
      slug: 'plus',
      name: 'Plus',
      priceAmount: 56000,
      durationDays: 30,
      features: ['Standard-ийн бүх давуу тал', '50 мин AI дуу хоолой', '700 AI толь бичиг/сар', '1.5x Sparks'],
      voiceMinutesLimit: 50,
      sttMinutesLimit: 120,
      dictionaryAiLimit: 700,
      aiTextTokensLimit: 400,
      memoryMbLimit: 250,
    },
    {
      slug: 'premier',
      name: 'Premier',
      priceAmount: 85000,
      durationDays: 30,
      features: ['Plus-ийн бүх давуу тал', 'Хязгааргүй AI мессеж', 'Хоолойн AI (Voice)', 'Тэргүүлэх дэмжлэг'],
      voiceMinutesLimit: null,
      sttMinutesLimit: null,
      dictionaryAiLimit: null,
      aiTextTokensLimit: null,
      memoryMbLimit: null,
    },
  ];
  for (const p of planDefs) {
    const exists = await planRepo.findOne({ where: { slug: p.slug } });
    if (!exists) {
      await planRepo.save(planRepo.create({ ...p, isActive: true }));
      console.log(`✅ Plan created: ${p.name} (${p.priceAmount.toLocaleString()} MNT/сар)`);
    } else {
      console.log(`— Plan already exists: ${p.name}, skipping`);
    }
  }

  // ── Admin user ──────────────────────────────────────────────────────────────
  const userRepo = ds.getRepository(User);
  let admin = await userRepo.findOne({ where: { email: 'admin@englishxp.mn' } });
  if (!admin) {
    admin = userRepo.create({
      email: 'admin@englishxp.mn',
      passwordHash: await bcrypt.hash('Admin1234!', 10),
      fullName: 'EnglishXP Admin',
      role: UserRole.ADMIN,
    });
    await userRepo.save(admin);
    console.log('✅ Admin user created (admin@englishxp.mn / Admin1234!)');
  } else {
    console.log('— Admin user already exists, skipping');
  }

  // ── Sample lesson ───────────────────────────────────────────────────────────
  const lessonRepo = ds.getRepository(Lesson);
  let lesson = await lessonRepo.findOne({ where: { title: 'Greeting Words (A1)' } });
  if (!lesson) {
    lesson = lessonRepo.create({
      title: 'Greeting Words (A1)',
      description: 'Мэндчилгэний үндсэн үгс',
      type: LessonType.VOCABULARY,
      level: ContentLevel.A1,
      content: { notes: 'Use these phrases when meeting someone for the first time.' },
      position: 1,
      isPublished: true,
      priceSparks: 0,
    });
    await lessonRepo.save(lesson);
    console.log('✅ Sample lesson created');
  } else {
    console.log('— Sample lesson already exists, skipping');
  }

  // ── Sample words ────────────────────────────────────────────────────────────
  const wordRepo = ds.getRepository(Word);
  const words = [
    { english: 'Hello', mongolian: 'Сайн байна уу', level: ContentLevel.A1 },
    { english: 'Goodbye', mongolian: 'Баяртай', level: ContentLevel.A1 },
    { english: 'Thank you', mongolian: 'Баярлалаа', level: ContentLevel.A1 },
    { english: 'Please', mongolian: 'Гуйя', level: ContentLevel.A1 },
    { english: 'Sorry', mongolian: 'Уучлаарай', level: ContentLevel.A1 },
    { english: 'Friend', mongolian: 'Найз', level: ContentLevel.A1 },
    { english: 'School', mongolian: 'Сургууль', level: ContentLevel.A1 },
    { english: 'Learn', mongolian: 'Сурах', level: ContentLevel.A2 },
    { english: 'Practice', mongolian: 'Дасгал хийх', level: ContentLevel.A2 },
    { english: 'Understand', mongolian: 'Ойлгох', level: ContentLevel.B1 },
  ];

  let wordsCreated = 0;
  for (const w of words) {
    const exists = await wordRepo.findOne({ where: { english: w.english } });
    if (!exists) {
      await wordRepo.save(wordRepo.create({ ...w, lessonId: lesson.id }));
      wordsCreated++;
    }
  }
  console.log(wordsCreated > 0 ? `✅ ${wordsCreated} words created` : '— Words already exist, skipping');

  // ── Sample quiz ─────────────────────────────────────────────────────────────
  const quizRepo = ds.getRepository(Quiz);
  let quiz = await quizRepo.findOne({ where: { title: 'Greeting Quiz (A1)' } });
  if (!quiz) {
    quiz = quizRepo.create({
      title: 'Greeting Quiz (A1)',
      description: 'Мэндчилгээний үгсийн шалгалт',
      level: ContentLevel.A1,
      xpReward: 20,
      isPublished: true,
      lessonId: lesson.id,
      questions: [
        {
          type: 'multiple_choice',
          question: 'What does "Hello" mean in Mongolian?',
          options: ['Баяртай', 'Сайн байна уу', 'Баярлалаа', 'Уучлаарай'],
          correct: 1,
          points: 5,
        },
        {
          type: 'multiple_choice',
          question: 'What does "Баярлалаа" mean in English?',
          options: ['Sorry', 'Goodbye', 'Thank you', 'Please'],
          correct: 2,
          points: 5,
        },
        {
          type: 'fill_blank',
          question: 'The English word for "Баяртай" is ___.',
          answer: 'Goodbye',
          points: 10,
        },
      ],
    });
    await quizRepo.save(quiz);
    console.log('✅ Sample quiz created (xpReward: 20)');
  } else {
    console.log('— Sample quiz already exists, skipping');
  }

  // ── Paid lesson (for Sparks unlock testing) ─────────────────────────────────
  let paidLesson = await lessonRepo.findOne({ where: { title: 'Advanced Grammar (B1)' } });
  if (!paidLesson) {
    paidLesson = lessonRepo.create({
      title: 'Advanced Grammar (B1)',
      description: 'Дэвшилтэт дүрмийн хичээл — Spark-аар нэвтрэх',
      type: LessonType.GRAMMAR,
      level: ContentLevel.B1,
      content: { notes: 'Unlockable paid lesson for testing Sparks store.' },
      position: 10,
      isPublished: true,
      priceSparks: 50,
    });
    await lessonRepo.save(paidLesson);
    console.log('✅ Paid lesson created (priceSparks: 50)');
  } else {
    console.log('— Paid lesson already exists, skipping');
  }

  // ── Skill lessons (Home grid: Сонсгол / Унших / Дүрэм / Бичих) ───────────────
  const skillLessons = [
    {
      title: 'Listening: Daily Conversations (A1)',
      description: 'Өдөр тутмын яриа сонсох',
      type: LessonType.LISTENING,
      level: ContentLevel.A1,
      content: { notes: 'Listen and answer simple questions about everyday talk.' },
      position: 2,
    },
    {
      title: 'Reading: Short Stories (A2)',
      description: 'Богино өгүүллэг унших',
      type: LessonType.READING,
      level: ContentLevel.A2,
      content: { notes: 'Read short passages and check comprehension.' },
      position: 3,
    },
    {
      title: 'Fill in the Blanks (A2)',
      description: 'Нөхөх даалгавар — хоосон зайг гүйцээх',
      type: LessonType.FILL,
      level: ContentLevel.A2,
      content: { notes: 'Complete sentences by filling the missing words.' },
      position: 4,
    },
    {
      title: 'Writing: Sentences (A2)',
      description: 'Энгийн өгүүлбэр бичих',
      type: LessonType.WRITING,
      level: ContentLevel.A2,
      content: { notes: 'Practice building correct simple sentences.' },
      position: 5,
    },
  ];

  let skillCreated = 0;
  for (const sl of skillLessons) {
    const exists = await lessonRepo.findOne({ where: { title: sl.title } });
    if (!exists) {
      await lessonRepo.save(lessonRepo.create({ ...sl, isPublished: true, priceSparks: 0 }));
      skillCreated++;
    }
  }
  console.log(skillCreated > 0 ? `✅ ${skillCreated} skill lessons created` : '— Skill lessons already exist, skipping');

  // ── Vocabulary bank (words-seed.json) ─────────────────────────────────────
  const seedFile = join(__dirname, 'words-seed.json');
  try {
    const raw = JSON.parse(readFileSync(seedFile, 'utf-8'));
    const wordDefs: any[] = Array.isArray(raw) ? raw : raw.words ?? [];
    let vocabInserted = 0;
    const BATCH = 50;
    for (let i = 0; i < wordDefs.length; i += BATCH) {
      const batch = wordDefs.slice(i, i + BATCH);
      await Promise.all(batch.map(async (w) => {
        if (!w.english || !w.mongolian) return;
        const level = (w.level ?? ContentLevel.A1) as ContentLevel;
        const exists = await wordRepo.findOne({ where: { english: w.english, level }, select: { id: true } });
        if (exists) return;
        await wordRepo.save(wordRepo.create({
          english: w.english,
          mongolian: w.mongolian,
          partOfSpeech: w.partOfSpeech ?? null,
          exampleSentence: w.exampleSentence ?? null,
          exampleTranslation: w.exampleTranslation ?? null,
          level,
        }));
        vocabInserted++;
      }));
    }
    console.log(vocabInserted > 0 ? `✅ ${vocabInserted} vocabulary words inserted` : '— Vocabulary words already exist, skipping');
  } catch {
    console.log('— words-seed.json олдсонгүй, алгасав');
  }
}

async function main() {
  console.log('🌱 Starting seed...\n');
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
  try {
    await seed(ds);
    console.log('\n✅ Seed complete.');
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
