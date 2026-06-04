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
import { Word } from '../entities/word.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { UserRole, LessonType, ContentLevel } from '../common/enums';

async function seed(ds: DataSource) {
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
