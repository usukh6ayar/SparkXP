/**
 * Promo codes against a REAL database — the rules a mocked repo would "pass"
 * while production handed out extra uses:
 *  - two people racing for a code's LAST use: exactly one wins;
 *  - one person tapping twice: one redemption, not two;
 *  - influencer direct grant: plan set for 7 days, recorded in the history.
 *
 * Prerequisites (same as app.e2e-spec.ts): Postgres + Redis, DB_SYNCHRONIZE=true,
 * a throwaway DB_NAME. Run with: npm run test:e2e
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PromosService } from '../src/promos/promos.service';
import { Plan } from '../src/entities/plan.entity';
import { PromoRedemption } from '../src/entities/promo-redemption.entity';
import { User } from '../src/entities/user.entity';
import { UserRole } from '../src/common/enums';

const RUN = Math.random().toString(36).slice(2, 8);
const DAY = 24 * 60 * 60 * 1000;

describe('Promo codes', () => {
  let app: INestApplication;
  let db: DataSource;
  let promos: PromosService;
  let planId: string;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    db = app.get(DataSource);
    promos = app.get(PromosService);
    const plans = db.getRepository(Plan);
    planId = (
      await plans.save(
        plans.create({
          name: `Plus ${RUN}`,
          slug: `plus-${RUN}`,
          priceAmount: 56000,
        }),
      )
    ).id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function student(tag: string): Promise<User> {
    const repo = db.getRepository(User);
    return repo.save(
      repo.create({
        username: `pr_${tag}_${RUN}`,
        email: `pr_${tag}_${RUN}@test.mn`,
        passwordHash: 'x',
        fullName: 'Promo Test',
        role: UserRole.STUDENT,
      }),
    );
  }

  it('gives the last use to exactly one of two racing users', async () => {
    const promo = await promos.create({
      name: 'race',
      kind: 'free_access',
      value: 7,
      planId,
      usageLimit: 1,
    });
    const [a, b] = await Promise.all([student('race_a'), student('race_b')]);

    const results = await Promise.allSettled([
      promos.redeem(a.id, promo.code),
      promos.redeem(b.id, promo.code),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await db
      .getRepository(PromoRedemption)
      .count({ where: { promoId: promo.id } });
    expect(rows).toBe(1);
    const used = await db.query(
      'SELECT used_count FROM promo_codes WHERE id = $1',
      [promo.id],
    );
    expect(used[0].used_count).toBe(1);
  });

  it('lets one user redeem a code only once, even on a double tap', async () => {
    const promo = await promos.create({
      name: 'tap',
      kind: 'free_access',
      value: 7,
      planId,
    });
    const u = await student('tap');

    const results = await Promise.allSettled([
      promos.redeem(u.id, promo.code),
      promos.redeem(u.id, promo.code),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await db
      .getRepository(PromoRedemption)
      .count({ where: { promoId: promo.id } });
    expect(rows).toBe(1);
  });

  it('grants an influencer 7 days straight onto their account', async () => {
    const u = await student('inf');
    const before = Date.now();

    const { promo, redemption } = await promos.grantInfluencer({
      planId,
      email: u.email,
    });

    expect(promo.audience).toBe('influencer');
    expect(promo.code.startsWith('INF-')).toBe(true);
    expect(redemption?.userId).toBe(u.id);
    const fresh = await db.getRepository(User).findOneByOrFail({ id: u.id });
    expect(fresh.planId).toBe(planId);
    const ms = fresh.planExpiresAt!.getTime() - before;
    expect(ms).toBeGreaterThan(7 * DAY - 60_000);
    expect(ms).toBeLessThan(7 * DAY + 60_000);
  });

  it('refuses a code made for someone else', async () => {
    const [owner, other] = await Promise.all([student('own'), student('oth')]);
    const promo = await promos.create({
      name: 'mine',
      kind: 'free_access',
      value: 7,
      planId,
      assignedUserId: owner.id,
    });
    await expect(promos.redeem(other.id, promo.code)).rejects.toThrow();
    await expect(
      promos.redeem(owner.id, promo.code.toLowerCase()),
    ).resolves.toBeDefined();
  });
});
