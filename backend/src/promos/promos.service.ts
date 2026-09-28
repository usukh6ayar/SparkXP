import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Plan } from '../entities/plan.entity';
import { PromoCode } from '../entities/promo-code.entity';
import { PromoRedemption } from '../entities/promo-redemption.entity';
import { User } from '../entities/user.entity';
import {
  CreatePromoDto,
  GrantInfluencerDto,
  UpdatePromoDto,
} from './dto/promo.dto';

/** Influencer trial length (task #6). Admin can override per grant. */
export const INFLUENCER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Codes are matched case-insensitively and stored upper-case. */
const normalise = (code: string) => code.trim().toUpperCase();

/** e.g. "INF-7K3Q9P" — no 0/O/1/I so a code read aloud can't be misheard. */
function randomCode(prefix: string): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `${prefix}-${out}`;
}

/** Final price after a discount code — never below 0. */
export function discountedPrice(
  price: number,
  promo: Pick<PromoCode, 'kind' | 'value'>,
): number {
  if (promo.kind === 'discount_percent')
    return Math.max(0, Math.round(price * (1 - promo.value / 100)));
  if (promo.kind === 'discount_fixed') return Math.max(0, price - promo.value);
  return price;
}

/**
 * New plan expiry for a free-access grant, or null when it must be refused.
 *
 * - no active plan            → now + days
 * - active, SAME plan         → extend from the current expiry
 * - active, DIFFERENT plan    → refuse: a promo must never swap a paying
 *                               user's plan for a (possibly lower) one.
 */
export function accessUntil(
  user: Pick<User, 'planId' | 'planExpiresAt'>,
  planId: string,
  days: number,
  now = new Date(),
): Date | null {
  const active =
    user.planId !== null &&
    (!user.planExpiresAt || user.planExpiresAt.getTime() > now.getTime());
  if (active && user.planId !== planId) return null;
  // An active plan with no expiry is already unlimited — nothing to extend.
  if (active && !user.planExpiresAt) return null;
  const from = active ? user.planExpiresAt!.getTime() : now.getTime();
  return new Date(from + days * DAY_MS);
}

@Injectable()
export class PromosService {
  constructor(
    @InjectRepository(PromoCode) private readonly promos: Repository<PromoCode>,
    @InjectRepository(PromoRedemption)
    private readonly redemptions: Repository<PromoRedemption>,
    @InjectRepository(Plan) private readonly plans: Repository<Plan>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Admin ──────────────────────────────────────────────────────────────

  list(audience?: string) {
    return this.promos.find({
      where: audience ? { audience: audience as PromoCode['audience'] } : {},
      relations: { plan: true, assignedUser: true },
      select: {
        plan: { id: true, name: true },
        assignedUser: { id: true, email: true, fullName: true },
      },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }

  async create(dto: CreatePromoDto, prefix = 'SPX'): Promise<PromoCode> {
    await this.assertValidShape(dto.kind, dto.value, dto.planId ?? null);
    const code = dto.code ? normalise(dto.code) : randomCode(prefix);
    if (await this.promos.exists({ where: { code } })) {
      throw new ConflictException(`«${code}» код аль хэдийн байна`);
    }
    return this.promos.save(
      this.promos.create({
        name: dto.name.trim(),
        code,
        kind: dto.kind,
        value: dto.value,
        planId: dto.planId ?? null,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        usageLimit: dto.usageLimit ?? null,
        isActive: dto.isActive ?? true,
        audience: dto.audience ?? 'general',
        assignedUserId: dto.assignedUserId ?? null,
        note: dto.note ?? null,
      }),
    );
  }

  /** Only the campaign knobs are editable — kind/value/code are what users redeemed. */
  async update(id: string, dto: UpdatePromoDto): Promise<PromoCode> {
    const promo = await this.promos.findOne({ where: { id } });
    if (!promo) throw new NotFoundException('Промо код олдсонгүй');
    if (dto.name !== undefined) promo.name = dto.name.trim();
    if (dto.isActive !== undefined) promo.isActive = dto.isActive;
    if (dto.validFrom !== undefined)
      promo.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined)
      promo.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.usageLimit !== undefined) promo.usageLimit = dto.usageLimit;
    if (dto.note !== undefined) promo.note = dto.note;
    return this.promos.save(promo);
  }

  /** Who used a code and what it gave them — newest first. */
  history(promoId: string) {
    return this.redemptions.find({
      where: { promoId },
      relations: { user: true },
      select: { user: { id: true, email: true, fullName: true } },
      order: { createdAt: 'DESC' },
      take: 500,
    });
  }

  /**
   * Influencer access (task #6), either way the brief asked for:
   * - `email` given → grant straight onto that account now, and record it as a
   *   one-person code so it still shows in the promo history;
   * - no `email`   → issue a code (`usageLimit` people, default 1).
   */
  async grantInfluencer(dto: GrantInfluencerDto) {
    const days = dto.days ?? INFLUENCER_DAYS;
    const target = dto.email
      ? await this.users.findOne({
          where: { email: dto.email.trim().toLowerCase() },
        })
      : null;
    if (dto.email && !target)
      throw new NotFoundException('Ийм имэйлтэй хэрэглэгч олдсонгүй');
    // Refuse BEFORE creating the code, or a failed grant leaves an orphan code.
    if (target && !accessUntil(target, dto.planId, days)) {
      throw new ConflictException(
        'Энэ хэрэглэгчид өөр идэвхтэй багц байгаа тул эрх олгох боломжгүй',
      );
    }

    const promo = await this.create(
      {
        name:
          dto.name?.trim() ||
          `Influencer ${days} хоног${target ? ` — ${target.email}` : ''}`,
        kind: 'free_access',
        value: days,
        planId: dto.planId,
        usageLimit: target ? 1 : (dto.usageLimit ?? 1),
        audience: 'influencer',
        assignedUserId: target?.id,
        validUntil: dto.validUntil,
        note: dto.note,
        code: undefined,
      },
      'INF',
    );

    if (!target) return { promo, redemption: null };
    const redemption = await this.redeemPromo(promo, target.id);
    return { promo, redemption };
  }

  // ─── User ───────────────────────────────────────────────────────────────

  /** The app's «Промо код» box. Only free-access codes redeem here. */
  async redeem(userId: string, rawCode: string) {
    const promo = await this.findUsable(rawCode, userId);
    if (promo.kind !== 'free_access') {
      throw new BadRequestException(
        'Энэ хөнгөлөлтийн код төлбөр хийх үед ашиглагдана',
      );
    }
    const redemption = await this.redeemPromo(promo, userId);
    return {
      code: promo.code,
      planId: promo.planId,
      planName: promo.plan?.name ?? null,
      days: promo.value,
      accessUntil: redemption.accessUntil,
    };
  }

  /** Price preview for a discount code (checkout). Writes nothing. */
  async quote(userId: string, rawCode: string, planId: string) {
    const promo = await this.findUsable(rawCode, userId);
    if (promo.kind === 'free_access') {
      throw new BadRequestException(
        'Энэ код үнэгүй эрхийн код — «Промо код» хэсэгт оруулна уу',
      );
    }
    if (promo.planId && promo.planId !== planId) {
      throw new BadRequestException('Энэ код өөр багцад зориулагдсан');
    }
    const plan = await this.plans.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('Багц олдсонгүй');
    return {
      promoId: promo.id,
      code: promo.code,
      originalPrice: plan.priceAmount,
      finalPrice: discountedPrice(plan.priceAmount, promo),
    };
  }

  /**
   * Records a discount use for a confirmed payment — called INSIDE the
   * payment-confirm transaction so the use and the payment commit together.
   */
  async recordDiscountUse(
    manager: EntityManager,
    promoId: string,
    userId: string,
    paymentId: string,
  ) {
    await this.claimUse(manager, promoId);
    await manager.insert(PromoRedemption, {
      promoId,
      userId,
      paymentId,
      accessUntil: null,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  /** Every "can this person use this code right now?" rule, in one place. */
  private async findUsable(
    rawCode: string,
    userId: string,
  ): Promise<PromoCode> {
    const promo = await this.promos.findOne({
      where: { code: normalise(rawCode) },
      relations: { plan: true },
    });
    const now = Date.now();
    // One message for "no such code" and "switched off" — no probing for codes.
    if (!promo || !promo.isActive)
      throw new NotFoundException('Промо код буруу эсвэл идэвхгүй байна');
    if (promo.validFrom && promo.validFrom.getTime() > now) {
      throw new BadRequestException('Энэ код хараахан эхлээгүй байна');
    }
    if (promo.validUntil && promo.validUntil.getTime() < now) {
      throw new BadRequestException('Энэ кодын хугацаа дууссан');
    }
    if (promo.assignedUserId && promo.assignedUserId !== userId) {
      throw new NotFoundException('Промо код буруу эсвэл идэвхгүй байна');
    }
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      throw new BadRequestException('Энэ кодын ашиглах эрх дууссан');
    }
    if (
      await this.redemptions.exists({ where: { promoId: promo.id, userId } })
    ) {
      throw new ConflictException('Та энэ кодыг аль хэдийн ашигласан');
    }
    return promo;
  }

  /**
   * Grants a free-access promo to a user: one transaction for the limit
   * check, the history row and the plan write.
   */
  private async redeemPromo(
    promo: PromoCode,
    userId: string,
  ): Promise<PromoRedemption> {
    if (!promo.planId)
      throw new BadRequestException('Энэ кодод багц тохируулаагүй байна');
    return this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        select: { id: true, planId: true, planExpiresAt: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

      const until = accessUntil(user, promo.planId!, promo.value);
      if (!until) {
        throw new ConflictException(
          'Танд өөр идэвхтэй багц байгаа тул энэ кодыг одоо ашиглах боломжгүй',
        );
      }

      await this.claimUse(manager, promo.id);
      const redemption = manager.create(PromoRedemption, {
        promoId: promo.id,
        userId,
        accessUntil: until,
        paymentId: null,
      });
      try {
        await manager.save(redemption);
      } catch {
        // The (promo, user) unique index — a double tap that raced past findUsable.
        throw new ConflictException('Та энэ кодыг аль хэдийн ашигласан');
      }
      await manager.update(
        User,
        { id: userId },
        { planId: promo.planId, planExpiresAt: until },
      );
      return redemption;
    });
  }

  /**
   * Takes one use, or refuses when none are left. The check and the increment
   * are ONE statement, so two people can't both take the last use.
   */
  private async claimUse(
    manager: EntityManager,
    promoId: string,
  ): Promise<void> {
    const rows: unknown[] = await manager.query(
      `UPDATE promo_codes SET used_count = used_count + 1, updated_at = now()
        WHERE id = $1 AND (usage_limit IS NULL OR used_count < usage_limit)
        RETURNING id`,
      [promoId],
    );
    // pg returns [rows, count] for UPDATE … RETURNING through TypeORM.
    const updated = Array.isArray(rows[0])
      ? (rows[0] as unknown[]).length
      : rows.length;
    if (!updated)
      throw new BadRequestException('Энэ кодын ашиглах эрх дууссан');
  }

  private async assertValidShape(
    kind: string,
    value: number,
    planId: string | null,
  ) {
    if (kind === 'discount_percent' && (value < 1 || value > 100)) {
      throw new BadRequestException('Хувь 1–100 хооронд байна');
    }
    if (kind === 'free_access') {
      if (value < 1 || value > 366)
        throw new BadRequestException('Хоног 1–366 хооронд байна');
      if (!planId)
        throw new BadRequestException(
          'Үнэгүй эрхэд аль багцыг олгохыг сонгоно уу',
        );
    }
    if (planId && !(await this.plans.exists({ where: { id: planId } }))) {
      throw new NotFoundException('Багц олдсонгүй');
    }
  }
}
