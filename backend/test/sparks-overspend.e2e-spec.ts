/**
 * The Sparks balance must never go negative, even under concurrency.
 *
 * This runs against a REAL database on purpose. The bug it guards against is a
 * time-of-check/time-of-use race: callers check the balance with a plain
 * SELECT *before* opening their transaction, so two concurrent spends both read
 * the same balance, both pass, and both deduct. Only Postgres's row lock during
 * the conditional UPDATE can catch that — a mocked repository would "pass"
 * while production quietly hands out free items.
 *
 * Prerequisites (same as app.e2e-spec.ts):
 *   - Postgres + Redis running, DB_SYNCHRONIZE=true, a throwaway DB_NAME.
 * Run with: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { SparksService } from '../src/sparks/sparks.service';
import { User } from '../src/entities/user.entity';
import { SparksSource, UserRole } from '../src/common/enums';

const RUN = Math.random().toString(36).slice(2, 8);

describe('Sparks — overspend protection', () => {
  let app: INestApplication;
  let db: DataSource;
  let sparks: SparksService;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    db = app.get(DataSource);
    sparks = app.get(SparksService);
  });

  afterAll(async () => { await app.close(); });

  /** A user holding exactly `balance` Sparks. */
  async function userWith(balance: number, tag: string): Promise<string> {
    const repo = db.getRepository(User);
    const saved = await repo.save(
      repo.create({
        username: `sp_${tag}_${RUN}`,
        email: `sp_${tag}_${RUN}@test.mn`,
        passwordHash: 'x',
        fullName: 'Sparks Test',
        role: UserRole.STUDENT,
        sparks: balance,
      }),
    );
    return saved.id;
  }

  const balanceOf = async (id: string): Promise<number> => {
    const rows = await db.query('SELECT sparks FROM users WHERE id = $1', [id]);
    return rows[0].sparks as number;
  };

  const spend = (userId: string, cost: number) =>
    sparks.change({ userId, amount: -cost, source: SparksSource.STORE_PURCHASE });

  it('rejects a single spend larger than the balance', async () => {
    const id = await userWith(50, 'single');
    await expect(spend(id, 80)).rejects.toThrow(/хүрэлцэхгүй/);
    expect(await balanceOf(id)).toBe(50);
  });

  it('lets two CONCURRENT spends through only while the balance covers them', async () => {
    // 100 Sparks, two simultaneous 80-Spark purchases of different items. Both
    // pass a pre-transaction balance check; only one may actually deduct.
    const id = await userWith(100, 'race');

    const results = await Promise.allSettled([spend(id, 80), spend(id, 80)]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;

    expect(ok).toBe(1);
    expect(await balanceOf(id)).toBe(20);
  });

  it('rolls the ledger row back when the deduction is refused', async () => {
    // A refused spend must not leave a SparksLog behind, or the append-only
    // ledger stops matching the cached balance it is supposed to explain.
    const id = await userWith(10, 'ledger');
    await expect(spend(id, 999)).rejects.toThrow();

    const rows = await db.query(
      'SELECT COUNT(*)::int AS n FROM sparks_logs WHERE user_id = $1',
      [id],
    );
    expect(rows[0].n).toBe(0);
  });

  it('still allows earning', async () => {
    const id = await userWith(0, 'earn');
    await sparks.change({ userId: id, amount: 25, source: SparksSource.STORE_PURCHASE });
    expect(await balanceOf(id)).toBe(25);
  });
});
