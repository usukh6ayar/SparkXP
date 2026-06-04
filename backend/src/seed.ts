/**
 * Seed script — inserts a starter admin + sample content for local dev/testing.
 *
 *   npm run seed
 *
 * Idempotent: re-running won't duplicate (it checks before inserting).
 * Uses the standalone DataSource (same as the migration CLI).
 */
import * as bcrypt from 'bcrypt';
import dataSource from './config/data-source';
import { User, Word, Lesson, Quiz } from './entities';
import { UserRole, LessonType, ContentLevel } from './common/enums';

async function seed() {
  await dataSource.initialize();
  console.log('🌱 Seeding database...');

  // --- Admin user ---
  const userRepo = dataSource.getRepository(User);
  const adminEmail = 'admin@englishxp.mn';
  let admin = await userRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    admin = await userRepo.save(
      userRepo.create({
        email: adminEmail,
        passwordHash: await bcrypt.hash('admin123', 10),
        fullName: 'EnglishXP Admin',
        role: UserRole.ADMIN,
      }),
    );
    console.log(`  ✅ Admin created: ${adminEmail} / admin123`);
  } else {
    console.log('  • Admin already exists, skipping');
  }

  // --- Sample words ---
  const wordRepo = dataSource.getRepository(Word);
  if ((await wordRepo.count()) === 0) {
    await wordRepo.save([
      wordRepo.create({ english: 'apple', mongolian: 'алим', partOfSpeech: 'noun', level: ContentLevel.A1 }),
      wordRepo.create({ english: 'book', mongolian: 'ном', partOfSpeech: 'noun', level: ContentLevel.A1 }),
      wordRepo.create({ english: 'run', mongolian: 'гүйх', partOfSpeech: 'verb', level: ContentLevel.A1 }),
      wordRepo.create({ english: 'beautiful', mongolian: 'үзэсгэлэнтэй', partOfSpeech: 'adjective', level: ContentLevel.A2 }),
      wordRepo.create({ english: 'quickly', mongolian: 'хурдан', partOfSpeech: 'adverb', level: ContentLevel.A2 }),
    ]);
    console.log('  ✅ 5 sample words created');
  } else {
    console.log('  • Words already exist, skipping');
  }

  // --- Sample lesson ---
  const lessonRepo = dataSource.getRepository(Lesson);
  let lesson = await lessonRepo.findOne({ where: { title: 'Basic Animals' } });
  if (!lesson) {
    lesson = await lessonRepo.save(
      lessonRepo.create({
        title: 'Basic Animals',
        description: 'Common animal vocabulary',
        type: LessonType.VOCABULARY,
        level: ContentLevel.A1,
        content: { slides: [{ english: 'cat', mongolian: 'муур' }, { english: 'dog', mongolian: 'нохой' }] },
        isPublished: true,
        priceSparks: 0,
      }),
    );
    console.log('  ✅ Sample lesson created: Basic Animals');
  } else {
    console.log('  • Lesson already exists, skipping');
  }

  // --- Sample quiz (linked to the lesson) ---
  const quizRepo = dataSource.getRepository(Quiz);
  if ((await quizRepo.count()) === 0) {
    await quizRepo.save(
      quizRepo.create({
        title: 'Animals Quiz',
        level: ContentLevel.A1,
        lessonId: lesson.id,
        xpReward: 10,
        isPublished: true,
        questions: [
          {
            type: 'multiple_choice',
            prompt: '"муур" гэдгийг англиар?',
            options: ['dog', 'cat', 'bird'],
            answerIndex: 1,
          },
        ],
      }),
    );
    console.log('  ✅ Sample quiz created: Animals Quiz');
  } else {
    console.log('  • Quiz already exists, skipping');
  }

  await dataSource.destroy();
  console.log('🌱 Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
