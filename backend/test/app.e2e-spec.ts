/**
 * E2e tests — Phase 1 core flows.
 *
 * Prerequisites:
 *   - Postgres running at DB_* env vars (use a separate test DB: DB_NAME=sparkxp_test)
 *   - Redis running at REDIS_* env vars
 *   - DB_SYNCHRONIZE=true so TypeORM creates tables automatically
 *
 * Run with: npm run test:e2e
 *
 * Every account this suite creates is namespaced by `RUN`, a fresh id per
 * process. Before that, the fixed addresses (`auth_test@test.mn`, …) survived
 * in whatever database the suite last touched, so the second run got 409 on
 * every register, the helper handed back an undefined token, and a dozen tests
 * failed with 401 — the suite only ever passed against a virgin DB. Namespacing
 * costs nothing and makes a rerun mean the same thing as a first run.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Unique per process — keeps one run's accounts from colliding with the next. */
const RUN = Math.random().toString(36).slice(2, 8);

/** Test address for `name`, namespaced by this run. */
const mail = (name: string) => `${name}_${RUN}@test.mn`;

async function createApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

/** Register + login, return JWT. */
async function registerAndLogin(
  app: INestApplication,
  email: string,
  password = 'Test1234!',
): Promise<string> {
  // username derived from the (unique) email local-part. Login doesn't require
  // email verification, so register → login still yields a usable token.
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ username: email.split('@')[0], email, password, fullName: 'Test User' });

  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ identifier: email, password });

  return res.body.accessToken as string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });

  it('POST /api/auth/register → 201 (pending verification)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ username: `auth_test_${RUN}`, email: mail('auth_test'), password: 'Test1234!', fullName: 'Auth Test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('pendingVerification', true);
  });

  it('POST /api/auth/login → 200 with token (username or email)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: `auth_test_${RUN}`, password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  // Sign-up has always rejected a username that differs only by case, so the
  // app promises `Bataa` and `bataa` are one person. Login used to demand the
  // exact case and lock that person out of their own account.
  it('POST /api/auth/login → identifier is case-insensitive (username)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: `AUTH_TEST_${RUN}`.toUpperCase(), password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/login → identifier is case-insensitive (email)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ identifier: mail('auth_test').toUpperCase(), password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/register → email that differs only by case is a duplicate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        username: `dupe_${RUN}`,
        email: mail('auth_test').toUpperCase(),
        password: 'Test1234!',
        fullName: 'Dupe',
      });
    expect(res.status).toBe(409);
  });

  it('GET /api/auth/me with valid token → 200', async () => {
    const token = await registerAndLogin(app, mail('me_test'));
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', mail('me_test'));
  });

  it('GET /api/auth/me without token → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ── Quiz submission + XP ─────────────────────────────────────────────────────

describe('Quiz submit + XP', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let quizId: string;

  beforeAll(async () => {
    app = await createApp();
    // Promote admin via DB so we can create content
    const ds = app.get(DataSource);
    adminToken = await registerAndLogin(app, mail('quiz_admin'));
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(
      `UPDATE users SET role = 'admin' WHERE id = $1`,
      [adminRes.body.id],
    );
    // Re-login to get a token with admin role (JWT payload doesn't carry role,
    // but the guard reads role from DB via JwtStrategy, so same token works)
    studentToken = await registerAndLogin(app, mail('quiz_student'));
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/quizzes (admin) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/quizzes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Test Quiz',
        level: 'a1',
        xpReward: 10,
        isPublished: true,
        questions: [
          { type: 'multiple_choice', question: 'Q1', options: ['A', 'B', 'C'], correct: 0, points: 5 },
          { type: 'fill_blank', question: 'Q2 ___', answer: 'hello', points: 5 },
        ],
      });
    expect(res.status).toBe(201);
    quizId = res.body.id;
  });

  it('POST /api/quizzes/:id/submit (all correct) → xpEarned = 10', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionIndex: 0, answer: 0 }, { questionIndex: 1, answer: 'hello' }] });
    expect(res.status).toBe(201);
    expect(res.body.percentage).toBe(100);
    expect(res.body.xpEarned).toBe(10);
  });

  it('POST /api/quizzes/:id/submit (no correct) → xpEarned = 0', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/quizzes/${quizId}/submit`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ answers: [{ questionIndex: 0, answer: 2 }, { questionIndex: 1, answer: 'wrong' }] });
    expect(res.status).toBe(201);
    expect(res.body.xpEarned).toBe(0);
  });

  it('GET /api/users/me/stats reflects XP increase', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.xp).toBeGreaterThanOrEqual(10);
  });
});

// ── Lesson completion + XP (idempotent) ──────────────────────────────────────

describe('Lesson complete + XP', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let lessonId: string;

  beforeAll(async () => {
    app = await createApp();
    const ds = app.get(DataSource);
    adminToken = await registerAndLogin(app, mail('lesson_admin'));
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);
    // Fresh student starts at xp = 0, so the assertions below can be exact.
    studentToken = await registerAndLogin(app, mail('lesson_student'));
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/lessons (admin, free) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/lessons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Free Lesson Test', type: 'vocabulary', level: 'a1', content: {}, isPublished: true });
    expect(res.status).toBe(201);
    lessonId = res.body.id;
  });

  it('POST /api/lessons/:id/complete → awards XP once (xpAwarded = 15)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(201);
    expect(res.body.alreadyCompleted).toBe(false);
    expect(res.body.xpAwarded).toBe(15);
  });

  it('GET /api/users/me/stats reflects the +15 XP', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.xp).toBe(15);
  });

  it('POST /api/lessons/:id/complete again → idempotent, no double XP', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/complete`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(201);
    expect(res.body.alreadyCompleted).toBe(true);
    expect(res.body.xpAwarded).toBe(0);

    const stats = await request(app.getHttpServer())
      .get('/api/users/me/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(stats.body.xp).toBe(15); // still 15 — not doubled
  });
});

// ── Sparks unlock ─────────────────────────────────────────────────────────────

describe('Sparks lesson unlock', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let lessonId: string;

  beforeAll(async () => {
    app = await createApp();
    const ds = app.get(DataSource);

    adminToken = await registerAndLogin(app, mail('sparks_admin'));
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);

    studentToken = await registerAndLogin(app, mail('sparks_student'));
    const studentRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentToken}`);
    // Give student 100 Sparks directly
    await ds.query(`UPDATE users SET sparks = 100 WHERE id = $1`, [studentRes.body.id]);
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/lessons (admin, priceSparks=50) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/lessons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Paid Lesson Test',
        type: 'vocabulary',
        level: 'b1',
        content: {},
        isPublished: true,
        priceSparks: 50,
      });
    expect(res.status).toBe(201);
    lessonId = res.body.id;
  });

  it('GET /api/lessons/:id/access → { hasAccess: false } before unlock', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}/access`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(false);
  });

  it('POST /api/lessons/:id/unlock → 201, Sparks deducted', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/unlock`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(201);

    const stats = await request(app.getHttpServer())
      .get('/api/users/me/stats')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(stats.body.sparks).toBe(50); // 100 - 50
  });

  it('GET /api/lessons/:id/access → { hasAccess: true } after unlock', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/lessons/${lessonId}/access`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.hasAccess).toBe(true);
  });

  it('POST /api/lessons/:id/unlock again → 409 Conflict', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lessonId}/unlock`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(409);
  });

  it('POST /api/lessons/:id/unlock with insufficient Sparks → 400', async () => {
    // Create another paid lesson and try to buy without enough Sparks
    const lesRes = await request(app.getHttpServer())
      .post('/api/lessons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Expensive Lesson', type: 'grammar', level: 'c1', content: {}, isPublished: true, priceSparks: 200 });
    const res = await request(app.getHttpServer())
      .post(`/api/lessons/${lesRes.body.id}/unlock`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(400);
  });
});

// ── Admin user list does not leak password hashes ─────────────────────────────

describe('Admin user list (no passwordHash leak)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    app = await createApp();
    const ds = app.get(DataSource);

    adminToken = await registerAndLogin(app, mail('userlist_admin'));
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);

    // Add another user so the list has more than one entry.
    await registerAndLogin(app, mail('userlist_student'));
  });

  afterAll(async () => { await app.close(); });

  it('GET /api/users (admin) → 200 and no passwordHash on any user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const user of res.body.items) {
      expect(user).not.toHaveProperty('passwordHash');
      expect(user).not.toHaveProperty('password_hash');
    }
  });

  it('PATCH /api/users/me → 200 and no passwordHash in response', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'Renamed Admin' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('fullName', 'Renamed Admin');
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('password_hash');
  });
});

// ── Phase 2: Organizations + Classes + Assignments ───────────────────────────

describe('Organizations + Classes + Assignments', () => {
  let app: INestApplication;
  let ds: DataSource;
  let adminToken: string;
  let teacherToken: string;
  let studentToken: string;
  let studentId: string;
  let orgId: string;
  let classId: string;
  let joinCode: string;
  let lessonId: string;
  let assignmentId: string;

  /** Promote the user behind `token` to `role` in the DB. */
  async function setRole(token: string, role: string): Promise<string> {
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    await ds.query(`UPDATE users SET role = $1 WHERE id = $2`, [role, me.body.id]);
    return me.body.id as string;
  }

  beforeAll(async () => {
    app = await createApp();
    ds = app.get(DataSource);

    adminToken = await registerAndLogin(app, mail('p2_admin'));
    await setRole(adminToken, 'admin');

    teacherToken = await registerAndLogin(app, mail('p2_teacher'));
    await setRole(teacherToken, 'teacher');

    studentToken = await registerAndLogin(app, mail('p2_student'));
    studentId = await setRole(studentToken, 'student');
  });

  afterAll(async () => { await app.close(); });

  // ── Organizations ──

  it('POST /api/organizations (admin) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test School',
        type: 'school',
        province: 'Улаанбаатар',
        district: 'Баянзүрх',
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.type).toBe('school');
    orgId = res.body.id;
  });

  it('POST /api/organizations (student) → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/organizations')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Nope', type: 'school' });
    expect(res.status).toBe(403);
  });

  it('GET /api/organizations → list includes the new org', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/organizations')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.some((o: { id: string }) => o.id === orgId)).toBe(true);
  });

  // ── Classes ──

  it('POST /api/classes (teacher) → 201 with a join code', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'English A1', organizationId: orgId });
    expect(res.status).toBe(201);
    expect(res.body.joinCode).toEqual(expect.any(String));
    expect(res.body.organizationId).toBe(orgId);
    classId = res.body.id;
    joinCode = res.body.joinCode;
  });

  it('POST /api/classes (student) → 403', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/classes')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(403);
  });

  // Joining is approval-gated: the code only files a REQUEST, and nothing about
  // the student changes until the teacher approves it. These three tests walk
  // that in order — request → still not enrolled → approve — because the gate
  // is the part worth protecting; an earlier version of this suite asserted the
  // old "join = instant enrolment" contract and went red when it changed.
  it('POST /api/classes/join (student) → 201 pending, not yet enrolled', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/classes/join')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ joinCode });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'pending', className: 'English A1' });
  });

  it('GET /api/classes/:id/requests (teacher) → the request is listed', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/classes/${classId}/requests`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    // A flat SafeUser[] — the requesting students themselves, not request rows.
    const mine = res.body.find((s: { id: string }) => s.id === studentId);
    expect(mine).toBeDefined();
    expect(mine).not.toHaveProperty('passwordHash');
  });

  it('teacher approves → student is enrolled', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/classes/${classId}/requests/${studentId}/approve`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(201);
  });

  it('approval inherits the org location onto the student', async () => {
    const rows = await ds.query(
      `SELECT province, district, organization_id FROM users WHERE id = $1`,
      [studentId],
    );
    expect(rows[0].province).toBe('Улаанбаатар');
    expect(rows[0].district).toBe('Баянзүрх');
    expect(rows[0].organization_id).toBe(orgId);
  });

  it('POST /api/classes/join again → 409', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/classes/join')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ joinCode });
    expect(res.status).toBe(409);
  });

  it('GET /api/classes (student) → class appears under enrolled', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/classes')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.enrolled.some((c: { id: string }) => c.id === classId)).toBe(true);
  });

  it('GET /api/classes/:id/students (teacher) → roster without hashes', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/classes/${classId}/students`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((s: { id: string }) => s.id === studentId)).toBe(true);
    for (const s of res.body) {
      expect(s).not.toHaveProperty('passwordHash');
    }
  });

  it('GET /api/classes/:id/students (student) → 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/classes/${classId}/students`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  // ── Assignments ──

  it('POST /api/lessons (admin) → 201 (target for the assignment)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/lessons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Assignable Lesson', type: 'vocabulary', level: 'a1', content: {}, isPublished: true });
    expect(res.status).toBe(201);
    lessonId = res.body.id;
  });

  it('POST /api/assignments (teacher) → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ classId, type: 'lesson', targetId: lessonId });
    expect(res.status).toBe(201);
    expect(res.body.classId).toBe(classId);
    assignmentId = res.body.id;
  });

  it('POST /api/assignments with unknown target → 400', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/assignments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ classId, type: 'lesson', targetId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
  });

  it('GET /api/assignments/mine (student) → includes the assignment', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/assignments/mine')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.some((a: { id: string }) => a.id === assignmentId)).toBe(true);
  });

  it('DELETE /api/assignments/:id (student) → 403', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(res.status).toBe(403);
  });

  it('DELETE /api/assignments/:id (teacher) → 204', async () => {
    const res = await request(app.getHttpServer())
      .delete(`/api/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${teacherToken}`);
    expect(res.status).toBe(204);
  });
});

// ── Health check ──────────────────────────────────────────────────────────────

describe('Health', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });

  it('GET /api/health → 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(res.body.redis).toBe('ok');
  });
});

// ── Толь (dictionary senses) ─────────────────────────────────────────────────

describe('Dictionary — Толь', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let adminToken: string;
  /** A word that only this run uses, so reruns don't collide. */
  const word = `zzrun${RUN}`;
  let entryId: string;
  /** A second, clearly non-matching seeded word — proves the admin `search`
   *  filter actually filters, and gives the DELETE test a row to sacrifice
   *  without touching the entry the other tests depend on. */
  const otherWord = `zzother${RUN}`;
  let otherEntryId: string;

  beforeAll(async () => {
    app = await createApp();
    ds = app.get(DataSource);
    token = await registerAndLogin(app, mail('dict_user'));

    // Promote to admin in the DB. No re-login needed: the JWT carries no role,
    // JwtStrategy reads it from the DB on every request.
    adminToken = await registerAndLogin(app, mail('dict_admin'));
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);

    // Seed the cache directly — the AI path is not exercised in e2e.
    const senses = JSON.stringify([
      { word, example: 'I run every morning.', translation: 'Би өглөө бүр гүйдэг.' },
      { word: `${word} out of`, example: 'We ran out of food.', translation: 'Бидний хоол дууссан.' },
    ]);
    const rows = await ds.query(
      `INSERT INTO dictionary_entries ("word", "senses", "search_count", "source")
       VALUES ($1, $2::jsonb, 0, 'seed') RETURNING id`,
      [word, senses],
    );
    entryId = rows[0].id;

    const otherSenses = JSON.stringify([
      { word: otherWord, example: 'Something else entirely.', translation: 'Өөр зүйл.' },
    ]);
    const otherRows = await ds.query(
      `INSERT INTO dictionary_entries ("word", "senses", "search_count", "source")
       VALUES ($1, $2::jsonb, 0, 'seed') RETURNING id`,
      [otherWord, otherSenses],
    );
    otherEntryId = otherRows[0].id;
  });

  afterAll(async () => {
    // ⭐ rows are keyed on the word, not on the entry — delete them first.
    await ds.query(`DELETE FROM user_dictionary_saves WHERE word LIKE $1`, [`%${RUN}%`]);
    await ds.query(`DELETE FROM translations WHERE word LIKE $1`, [`%${RUN}%`]);
    await ds.query(`DELETE FROM dictionary_entries WHERE word LIKE $1`, [`%${RUN}%`]);
    await app.close();
  });

  it('GET /api/dictionary/search/:word → cached senses', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dictionary/search/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cached).toBe(true);
    expect(res.body.senses).toHaveLength(2);
    expect(res.body.senses[0].translation).toBe('Би өглөө бүр гүйдэг.');
  });

  it('a cache hit still increments search_count', async () => {
    const before = await ds.query(
      `SELECT search_count FROM dictionary_entries WHERE id = $1`,
      [entryId],
    );
    await request(app.getHttpServer())
      .get(`/api/dictionary/search/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const after = await ds.query(
      `SELECT search_count, last_searched_at FROM dictionary_entries WHERE id = $1`,
      [entryId],
    );

    expect(Number(after[0].search_count)).toBe(Number(before[0].search_count) + 1);
    expect(after[0].last_searched_at).not.toBeNull();
  });

  it('POST /api/dictionary/saves/:word toggles the star both ways', async () => {
    const on = await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(on.body.saved).toBe(true);

    const listed = await request(app.getHttpServer())
      .get('/api/dictionary/saves')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.map((r: { word: string }) => r.word)).toContain(word);
    expect(listed.body[0].senses).toHaveLength(2);

    const off = await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(off.body.saved).toBe(false);
  });

  it('starring never creates a row in the curated words bank', async () => {
    await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const rows = await ds.query(`SELECT id FROM words WHERE english = $1`, [word]);
    expect(rows).toHaveLength(0);
  });

  it('GET /api/dictionary/admin/entries is admin-only, and search actually filters', async () => {
    await request(app.getHttpServer())
      .get('/api/dictionary/admin/entries')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get(`/api/dictionary/admin/entries?search=${word}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].word).toBe(word);
    // Proves the filter excludes, not just includes: without this, `total: 1`
    // would also pass if `search` were silently ignored.
    expect(res.body.items.map((i: { word: string }) => i.word)).not.toContain(otherWord);
  });

  it('GET /api/dictionary/admin/entries without search → lists both seeded entries', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/dictionary/admin/entries')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
    const words = res.body.items.map((i: { word: string }) => i.word);
    expect(words).toContain(word);
    expect(words).toContain(otherWord);
  });

  it('DELETE /api/dictionary/admin/entries/:id — admin-only, really deletes, 404 on repeat', async () => {
    // Sacrifice the second entry, not the one later tests still depend on.
    await request(app.getHttpServer())
      .delete(`/api/dictionary/admin/entries/${otherEntryId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/dictionary/admin/entries/${otherEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const rows = await ds.query(
      `SELECT id FROM dictionary_entries WHERE id = $1`,
      [otherEntryId],
    );
    expect(rows).toHaveLength(0);

    await request(app.getHttpServer())
      .delete(`/api/dictionary/admin/entries/${otherEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  // Runs BEFORE the PATCH test below: PATCH intentionally overwrites entryId's
  // senses down to one edited sense, which would invalidate the "first sense
  // translation" fallback this test asserts against the original seed data.
  it('listSaves subtitle: sense translation, then the reader gloss outranks it', async () => {
    // Don't assume `word`'s current saved state from earlier tests — read it
    // back and flip once more if needed, so this test is self-contained.
    let toggle = await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    if (!toggle.body.saved) {
      toggle = await request(app.getHttpServer())
        .post(`/api/dictionary/saves/${word}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
    }
    expect(toggle.body.saved).toBe(true);

    // No `translations` row yet for `word` → subtitle falls back to the first
    // sense's translation (design §4.3).
    const before = await request(app.getHttpServer())
      .get('/api/dictionary/saves')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const beforeRow = before.body.find((r: { word: string }) => r.word === word);
    expect(beforeRow).toBeDefined();
    expect(beforeRow.translation).toBe('Би өглөө бүр гүйдэг.');

    // A reader-tap gloss, once cached, outranks the sense translation.
    await ds.query(
      `INSERT INTO translations ("word", "translation") VALUES ($1, $2)`,
      [word, 'Гүйх (тайлбар толь)'],
    );
    const after = await request(app.getHttpServer())
      .get('/api/dictionary/saves')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const afterRow = after.body.find((r: { word: string }) => r.word === word);
    expect(afterRow.translation).toBe('Гүйх (тайлбар толь)');
  });

  it('PATCH /api/dictionary/admin/entries/:id marks the entry edited', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/dictionary/admin/entries/${entryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        senses: [
          { word, example: 'Edited example.', translation: 'Зассан орчуулга.' },
        ],
      })
      .expect(200);

    expect(res.body.edited).toBe(true);
    expect(res.body.senses).toHaveLength(1);
  });

  // The guard rails in search(). Both reject before any Gemini call is made,
  // so they cost nothing to test — and an over-long word reaching the AI is a
  // real way to make the server spend money on junk.
  it('rejects a blank or over-long search word without calling the AI', async () => {
    await request(app.getHttpServer())
      .get(`/api/dictionary/search/${encodeURIComponent('   ')}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await request(app.getHttpServer())
      .get(`/api/dictionary/search/${'a'.repeat(121)}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
