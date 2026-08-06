/**
 * Lesson stars — the feature PR #216 shipped without a test, and the one its
 * author flagged as unverified ("stars didn't fill locally").
 *
 * Runs against a REAL database because the suspected cause was schema, not
 * logic: the `user_lesson_stars` table simply did not exist on the running
 * backend. A mocked repository cannot tell you that.
 *
 * Prerequisites (same as app.e2e-spec.ts):
 *   - Postgres + Redis running, DB_SYNCHRONIZE=true, a throwaway DB_NAME.
 * Run with: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { StarsService } from '../src/xp/stars.service';
import { User } from '../src/entities/user.entity';
import { Lesson } from '../src/entities/lesson.entity';
import { UserRole, LessonType, ContentLevel } from '../src/common/enums';

const RUN = Math.random().toString(36).slice(2, 8);

describe('Lesson stars', () => {
  let app: INestApplication;
  let db: DataSource;
  let stars: StarsService;
  let userId: string;
  let lessonId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    db = app.get(DataSource);
    stars = app.get(StarsService);

    const users = db.getRepository(User);
    userId = (
      await users.save(
        users.create({
          username: `star_${RUN}`,
          email: `star_${RUN}@test.mn`,
          passwordHash: 'x',
          fullName: 'Star Test',
          role: UserRole.STUDENT,
        }),
      )
    ).id;

    const lessons = db.getRepository(Lesson);
    const lesson = lessons.create({
      title: `Star lesson ${RUN}`,
      type: LessonType.READING,
      level: ContentLevel.A1,
      isPublished: true,
    });
    lessonId = (await lessons.save(lesson)).id;
  });

  afterAll(async () => { await app.close(); });

  const row = async () =>
    (
      await db.query(
        'SELECT stars, best_score FROM user_lesson_stars WHERE user_id = $1 AND lesson_id = $2',
        [userId, lessonId],
      )
    )[0] as { stars: number; best_score: number } | undefined;

  it('the user_lesson_stars table exists', async () => {
    // The exact failure the PR author hit: an old running backend had no table,
    // so every award silently threw and no star ever appeared.
    const [{ exists }] = await db.query(
      `SELECT to_regclass('public.user_lesson_stars') IS NOT NULL AS exists`,
    );
    expect(exists).toBe(true);
  });

  it('writes no row for a failing score', async () => {
    // Below 50% earns nothing — an empty 0-star row would make the map look
    // like the lesson had been attempted and passed.
    expect(await stars.awardFromScore(userId, lessonId, 30)).toBe(0);
    expect(await row()).toBeUndefined();
  });

  it.each([
    [55, 1],
    [75, 2],
    [95, 3],
  ])('awards the right star count for %i%%', async (pct, expected) => {
    expect(await stars.awardFromScore(userId, lessonId, pct)).toBe(expected);
    expect((await row())?.stars).toBe(expected);
  });

  it('never lowers an earned star count (monotonic best-of)', async () => {
    // Retaking a lesson badly must not take stars away.
    expect(await stars.awardFromScore(userId, lessonId, 51)).toBe(3);
    const r = await row();
    expect(r?.stars).toBe(3);
    expect(r?.best_score).toBe(95);
  });

  it('counts toward the user total', async () => {
    expect(await stars.totalStars(userId)).toBe(3);
  });
});
