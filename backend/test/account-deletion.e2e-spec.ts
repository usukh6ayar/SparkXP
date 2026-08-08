/**
 * E2e tests for `DELETE /api/users/me` — App Store Guideline 5.1.1(v).
 *
 * These run against a REAL database on purpose. The whole risk in
 * `AccountDeletionService` is foreign keys: a child row nobody remembered makes
 * the final `DELETE FROM users` fail, and it fails only where the data exists.
 * A mocked repository would happily "pass" while production 500s.
 *
 * ⚠️ **Only two accounts are registered by this whole file.** `POST
 * /auth/register` is throttled to 3 per 5 minutes per IP (`EMAIL_SEND` in
 * auth.controller.ts) because it sends an OTP email — a suite that signs up
 * once per test hits 429 and fails on a rate limit rather than on the thing it
 * meant to check. One account walks the whole reject→delete→dead-token path.
 *
 * Prerequisites (same as app.e2e-spec.ts):
 *   - Postgres + Redis running, DB_SYNCHRONIZE=true, a throwaway DB_NAME.
 * Run with: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { Redis } from 'ioredis';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { REDIS_CLIENT } from '../src/redis/redis.module';
import { XpSource } from '../src/common/enums';

const RUN = Math.random().toString(36).slice(2, 8);
const PASSWORD = 'Test1234!';

describe('Account deletion (DELETE /api/users/me)', () => {
  let app: INestApplication;
  let db: DataSource;
  /** The account that walks the full lifecycle (tests run in declared order). */
  let victim: { token: string; id: string };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    app.setGlobalPrefix('api');
    await app.init();
    db = app.get(DataSource);

    victim = await newUser('del_main');
  });

  afterAll(async () => { await app.close(); });

  /** Register → verify the emailed OTP, returning the token and user id. */
  async function newUser(name: string): Promise<{ token: string; id: string }> {
    const username = `${name}_${RUN}`;
    const email = `${username}@test.mn`;

    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ username, email, password: PASSWORD, fullName: 'Delete Me' });
    // Surface a 429 as itself — otherwise the next line fails with an opaque
    // "cannot read property of undefined" and hides the rate limit.
    expect(reg.status).toBe(201);

    // Sign-in refuses an unverified account (403 EMAIL_NOT_VERIFIED), so the
    // token has to come from the verify step — the same path a real user walks.
    // The code can't be emailed here, so it is read from the store the service
    // writes it to.
    const code = await app.get<Redis>(REDIS_CLIENT).get(`otp:verify:${email.toLowerCase()}`);
    if (!code) throw new Error(`No verify OTP in Redis for ${email}`);

    const res = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ email, code });

    return { token: res.body.accessToken as string, id: res.body.user.id as string };
  }

  const rowCount = async (table: string, column: string, id: string): Promise<number> => {
    const rows = await db.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE ${column} = $1`, [id]);
    return rows[0].n as number;
  };

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .send({ password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it('rejects a wrong password and keeps the account', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${victim.token}`)
      .send({ password: 'NotMyPassword1!' });

    expect(res.status).toBe(401);
    expect(await rowCount('users', 'id', victim.id)).toBe(1);
  });

  it('deletes the account, its child rows, and kills the token', async () => {
    // Give the account a child row first — an empty account would delete
    // cleanly whether or not the foreign keys were handled.
    await db.query(
      `INSERT INTO xp_logs (user_id, amount, source) VALUES ($1, 10, $2)`,
      [victim.id, XpSource.ONBOARDING],
    );
    expect(await rowCount('xp_logs', 'user_id', victim.id)).toBe(1);

    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${victim.token}`)
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(await rowCount('users', 'id', victim.id)).toBe(0);
    expect(await rowCount('xp_logs', 'user_id', victim.id)).toBe(0);

    // The JWT is still cryptographically valid, so the guard has to fail on the
    // user lookup. If it did not, a deleted account could keep using the API.
    const after = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${victim.token}`);

    expect(after.status).toBe(401);
  });

  it('keeps payments as anonymous records instead of deleting them', async () => {
    const buyer = await newUser('del_paid');

    // A financial record has to survive the account (accounting / disputes),
    // detached from the person — that is why payments.user_id is nullable.
    const [payment] = await db.query(
      `INSERT INTO payments (user_id, amount, currency, status, provider)
       VALUES ($1, 1000, 'MNT', 'pending', 'qpay') RETURNING id`,
      [buyer.id],
    );

    const res = await request(app.getHttpServer())
      .delete('/api/users/me')
      .set('Authorization', `Bearer ${buyer.token}`)
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);

    const rows = await db.query('SELECT user_id FROM payments WHERE id = $1', [payment.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].user_id).toBeNull();
  });
});
