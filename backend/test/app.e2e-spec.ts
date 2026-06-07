/**
 * E2e tests — Phase 1 core flows.
 *
 * Prerequisites:
 *   - Postgres running at DB_* env vars (use a separate test DB: DB_NAME=englishxp_test)
 *   - Redis running at REDIS_* env vars
 *   - DB_SYNCHRONIZE=true so TypeORM creates tables automatically
 *
 * Run with: npm run test:e2e
 *
 * Each describe block is independent; the suite cleans up its own data.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// ── helpers ──────────────────────────────────────────────────────────────────

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
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password, fullName: 'Test User' });

  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });

  return res.body.accessToken as string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

describe('Auth', () => {
  let app: INestApplication;

  beforeAll(async () => { app = await createApp(); });
  afterAll(async () => { await app.close(); });

  it('POST /api/auth/register → 201', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'auth_test@test.mn', password: 'Test1234!', fullName: 'Auth Test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('POST /api/auth/login → 200 with token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'auth_test@test.mn', password: 'Test1234!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('GET /api/auth/me with valid token → 200', async () => {
    const token = await registerAndLogin(app, 'me_test@test.mn');
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('email', 'me_test@test.mn');
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
    adminToken = await registerAndLogin(app, 'quiz_admin@test.mn');
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(
      `UPDATE users SET role = 'admin' WHERE id = $1`,
      [adminRes.body.id],
    );
    // Re-login to get a token with admin role (JWT payload doesn't carry role,
    // but the guard reads role from DB via JwtStrategy, so same token works)
    studentToken = await registerAndLogin(app, 'quiz_student@test.mn');
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

// ── Sparks unlock ─────────────────────────────────────────────────────────────

describe('Sparks lesson unlock', () => {
  let app: INestApplication;
  let adminToken: string;
  let studentToken: string;
  let lessonId: string;

  beforeAll(async () => {
    app = await createApp();
    const ds = app.get(DataSource);

    adminToken = await registerAndLogin(app, 'sparks_admin@test.mn');
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);

    studentToken = await registerAndLogin(app, 'sparks_student@test.mn');
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

    adminToken = await registerAndLogin(app, 'userlist_admin@test.mn');
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);

    // Add another user so the list has more than one entry.
    await registerAndLogin(app, 'userlist_student@test.mn');
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

    adminToken = await registerAndLogin(app, 'p2_admin@test.mn');
    await setRole(adminToken, 'admin');

    teacherToken = await registerAndLogin(app, 'p2_teacher@test.mn');
    await setRole(teacherToken, 'teacher');

    studentToken = await registerAndLogin(app, 'p2_student@test.mn');
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

  it('POST /api/classes/join (student) → 201, no passwordHash leaked', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/classes/join')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ joinCode });
    expect(res.status).toBe(201);
    expect(res.body.students.some((s: { id: string }) => s.id === studentId)).toBe(true);
    for (const s of res.body.students) {
      expect(s).not.toHaveProperty('passwordHash');
    }
  });

  it('joining inherits the org location onto the student', async () => {
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
