import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { User } from '../entities/user.entity';
import { PaymentStatus } from '../common/enums';
import { ReferralsService } from '../referrals/referrals.service';
import { PromosService } from '../promos/promos.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { planAccessAfterPurchase } from './plan-access';
import { BylClient } from './byl/byl.client';
import { verifyBylSignature } from './byl/byl-signature';
import { paymentError } from './payments-errors';
import { VoicePacksService, type PackMeta } from './voice-packs.service';

/** Processed Byl event ids — Byl retries for ~4 days; keep a week. */
const EVENT_TTL_SECONDS = 7 * 24 * 3600;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PlanMeta {
  type: 'plan';
  planId: string;
  planSlug: string;
  planName: string;
  durationDays: number;
  listPrice: number;
  discount: number;
  promoId?: string;
  promoCode?: string;
  accessUntil?: string;
  mismatch?: boolean;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly referrals: ReferralsService,
    private readonly promos: PromosService,
    private readonly dataSource: DataSource,
    private readonly byl: BylClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
    private readonly packs: VoicePacksService,
  ) {}

  /** Price + promo + the expiry this purchase would give. Shown before paying. */
  async quote(user: Pick<User, 'id'>, dto: CreatePaymentDto) {
    const plan = await this.activePlan(dto.planId);
    let finalPrice = plan.priceAmount;
    let promoId: string | undefined;
    let promoCode: string | undefined;
    if (dto.promoCode?.trim()) {
      const q = await this.promos.quote(user.id, dto.promoCode, plan.id);
      finalPrice = q.finalPrice;
      promoId = q.promoId;
      promoCode = q.code;
    }
    if (finalPrice < 100) {
      throw paymentError(
        HttpStatus.BAD_REQUEST,
        'PRICE_TOO_LOW',
        'Энэ кодоор төлбөр үүсгэх боломжгүй — «Промо код» хэсэгт оруулна уу.',
      );
    }
    const accessUntil = await this.accessFor(user.id, plan);
    return {
      planId: plan.id,
      planName: plan.name,
      price: plan.priceAmount,
      discount: plan.priceAmount - finalPrice,
      finalPrice,
      accessUntil: accessUntil.toISOString(),
      promoId,
      promoCode,
      plan,
    };
  }

  /** Pending payment + Byl checkout. Nothing is granted here — only the webhook grants. */
  async createCheckout(user: Pick<User, 'id'>, dto: CreatePaymentDto) {
    const q = await this.quote(user, dto);
    const meta: PlanMeta = {
      type: 'plan',
      planId: q.plan.id,
      planSlug: q.plan.slug,
      planName: q.plan.name,
      durationDays: q.plan.durationDays,
      listPrice: q.price,
      discount: q.discount,
      ...(q.promoId ? { promoId: q.promoId, promoCode: q.promoCode } : {}),
    };
    const payment = await this.createPending(user.id, q.finalPrice, meta);
    return this.openBylCheckout(payment, {
      name: `SparkXP ${q.plan.name} — ${q.plan.durationDays} хоног`,
      ref: q.plan.slug,
      price: q.price,
      discount:
        q.discount > 0
          ? { amount: q.discount, description: `Промо код ${q.promoCode}` }
          : undefined,
      cancelPath: `/checkout?plan=${q.plan.slug}&canceled=1`,
    });
  }

  /** Pay-as-you-go: pending payment + Byl checkout for a pack of Buddy minutes. */
  async createPackCheckout(user: Pick<User, 'id'>, packId: string) {
    const pack = await this.packs.activePack(packId);
    const payment = await this.createPending(
      user.id,
      pack.priceAmount,
      this.packs.meta(pack),
    );
    return this.openBylCheckout(payment, {
      name: `SparkXP ${pack.name}`,
      ref: pack.slug,
      price: pack.priceAmount,
      cancelPath: `/checkout?pack=${pack.slug}&canceled=1`,
    });
  }

  private createPending(
    userId: string,
    amount: number,
    meta: PlanMeta | PackMeta,
  ): Promise<Payment> {
    return this.paymentRepo.save(
      this.paymentRepo.create({
        userId,
        amount,
        currency: 'MNT',
        provider: 'byl',
        status: PaymentStatus.PENDING,
        metadata: meta as unknown as Record<string, unknown>,
      }),
    );
  }

  /** Byl's hosted page for a pending payment; FAILED if Byl refuses. */
  private async openBylCheckout(
    payment: Payment,
    item: {
      name: string;
      ref: string;
      price: number;
      discount?: { amount: number; description: string };
      cancelPath: string;
    },
  ) {
    const web = this.config.get<string>('WEB_URL') ?? '';
    try {
      const checkout = await this.byl.createCheckout({
        items: [
          {
            price_data: {
              unit_amount: item.price,
              product_data: { name: item.name, client_reference_id: item.ref },
            },
            quantity: 1,
          },
        ],
        ...(item.discount ? { discounts: [item.discount] } : {}),
        client_reference_id: payment.id,
        success_url: `${web}/checkout/success?payment=${payment.id}`,
        cancel_url: `${web}${item.cancelPath}`,
        email_collection: false, // phone-first users may have no email
      });
      payment.providerRef = String(checkout.id);
      await this.paymentRepo.save(payment);
      return { paymentId: payment.id, checkoutUrl: checkout.url };
    } catch (err) {
      payment.status = PaymentStatus.FAILED;
      await this.paymentRepo.save(payment);
      throw err;
    }
  }

  /**
   * POST /payments/webhook/byl. The ONLY path that grants a purchase.
   * Returns normally for anything we deliberately ignore (Byl stops retrying
   * on 2xx); throws 401 only for a bad signature.
   */
  async handleBylWebhook(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Promise<void> {
    if (
      !verifyBylSignature(
        rawBody,
        signature,
        this.config.get<string>('BYL_WEBHOOK_SECRET'),
      )
    ) {
      throw paymentError(
        HttpStatus.UNAUTHORIZED,
        'BAD_SIGNATURE',
        'Invalid signature',
      );
    }
    const event = JSON.parse(rawBody!.toString('utf8')) as {
      id: number | string;
      type: string;
      data?: { object?: { id?: number; client_reference_id?: string | null } };
    };
    if (event.type !== 'checkout.completed') return;
    if (
      (await this.redis.set(
        `byl:event:${event.id}`,
        '1',
        'EX',
        EVENT_TTL_SECONDS,
        'NX',
      )) === null
    )
      return;

    const paymentId = event.data?.object?.client_reference_id ?? '';
    // Our ids are UUIDs; anything else (another integration on the same Byl
    // project, a test event) must be ignored, not crash the query with a 500 —
    // a non-2xx makes Byl retry for days.
    const payment = UUID_RE.test(paymentId)
      ? await this.paymentRepo.findOne({ where: { id: paymentId } })
      : null;
    if (!payment || payment.provider !== 'byl') {
      this.logger.warn(`Byl event ${event.id}: no byl payment ${paymentId}`);
      return;
    }
    if (payment.status === PaymentStatus.PAID) return;

    // Defence in depth: ask Byl itself instead of trusting the event body.
    const checkout = await this.byl.getCheckout(payment.providerRef ?? '');
    if (checkout.status !== 'complete') {
      this.logger.warn(
        `Byl checkout ${checkout.id} is ${checkout.status} — not granting ${payment.id}`,
      );
      return;
    }
    const paid = Math.round(Number(checkout.amount_total));
    const meta = payment.metadata as unknown as PlanMeta | PackMeta;
    if (paid !== payment.amount) {
      if (this.config.get<string>('BYL_TEST_MODE') === 'true') {
        this.logger.log(
          `Byl test mode: paid ${paid}₮ for ${payment.amount}₮ (test checkouts are fixed at 100₮)`,
        );
      } else {
        this.logger.error(
          `Byl amount mismatch on ${payment.id}: paid ${paid}, expected ${payment.amount}`,
        );
        payment.metadata = { ...meta, mismatch: true } as unknown as Record<
          string,
          unknown
        >;
        await this.paymentRepo.save(payment);
        return;
      }
    }

    if (meta.type === 'voice_pack') await this.packs.grant(payment, meta);
    else await this.grant(payment, meta);
  }

  /** The buyer's own payment, for the website's success page. */
  async findOne(user: Pick<User, 'id'>, id: string) {
    const p = await this.paymentRepo.findOne({ where: { id } });
    if (!p || p.userId !== user.id)
      throw new NotFoundException('Төлбөр олдсонгүй');
    const meta = (p.metadata ?? {}) as Partial<PlanMeta> & Partial<PackMeta>;
    return {
      id: p.id,
      status: p.status,
      kind: meta.type === 'voice_pack' ? 'voice_pack' : 'plan',
      planName: meta.planName ?? null,
      accessUntil: meta.accessUntil ?? null,
      /** Pack purchases only: minutes added to the balance. */
      voiceMinutes: meta.voiceMinutes ?? null,
      sttMinutes: meta.sttMinutes ?? null,
    };
  }

  private async grant(payment: Payment, meta: PlanMeta): Promise<void> {
    const plan = await this.planRepo.findOne({ where: { id: meta.planId } });
    if (!plan) {
      this.logger.error(
        `Paid payment ${payment.id} references missing plan ${meta.planId}`,
      );
      return;
    }
    await this.dataSource.transaction(async (manager) => {
      const buyer = await manager.findOne(User, {
        where: { id: payment.userId! },
        relations: { plan: true },
      });
      const until =
        planAccessAfterPurchase(
          {
            planId: buyer?.planId ?? null,
            planExpiresAt: buyer?.planExpiresAt ?? null,
            planPrice: buyer?.plan?.priceAmount ?? 0,
          },
          {
            planId: plan.id,
            price: plan.priceAmount,
            durationDays: plan.durationDays,
          },
        ) ??
        // Unlimited plan was active (quote refused, but a race got here): don't shorten it.
        null;

      payment.status = PaymentStatus.PAID;
      payment.metadata = {
        ...meta,
        accessUntil: until?.toISOString(),
      } as unknown as Record<string, unknown>;
      await manager.save(Payment, payment);
      if (until)
        await manager.update(
          User,
          { id: payment.userId! },
          { planId: plan.id, planExpiresAt: until },
        );
      if (meta.promoId)
        await this.promos.recordDiscountUse(
          manager,
          meta.promoId,
          payment.userId!,
          payment.id,
        );
      await this.referrals.creditFirstPurchaseBonus(manager, payment.userId!);
    });
  }

  private async activePlan(planId: string): Promise<Plan> {
    const plan = await this.planRepo.findOne({
      where: { id: planId, isActive: true },
    });
    if (!plan)
      throw paymentError(
        HttpStatus.NOT_FOUND,
        'PLAN_NOT_FOUND',
        'Багц олдсонгүй',
      );
    return plan;
  }

  private async accessFor(userId: string, plan: Plan): Promise<Date> {
    const u = await this.userRepo.findOne({
      where: { id: userId },
      relations: { plan: true },
    });
    const until = planAccessAfterPurchase(
      {
        planId: u?.planId ?? null,
        planExpiresAt: u?.planExpiresAt ?? null,
        planPrice: u?.plan?.priceAmount ?? 0,
      },
      {
        planId: plan.id,
        price: plan.priceAmount,
        durationDays: plan.durationDays,
      },
    );
    if (!until) {
      throw paymentError(
        HttpStatus.CONFLICT,
        'PLAN_SWITCH_BLOCKED',
        'Таны одоогийн багц хугацаагүй тул өөр багц авах боломжгүй.',
      );
    }
    return until;
  }

  findMy(user: User): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin: all payments with user info. */
  findAll(): Promise<Payment[]> {
    return this.paymentRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin: list all active plans. */
  findAllPlans(): Promise<Plan[]> {
    return this.planRepo.find({ order: { priceAmount: 'ASC' } });
  }

  /** Admin: create a new subscription plan. */
  async createPlan(dto: CreatePlanDto): Promise<Plan> {
    const plan = this.planRepo.create({
      name: dto.name,
      slug: dto.slug,
      priceAmount: dto.priceAmount,
      durationDays: dto.durationDays,
      features: dto.features ?? null,
      isActive: dto.isActive ?? true,
      voiceMinutesLimit: dto.voiceMinutesLimit ?? null,
      sttMinutesLimit: dto.sttMinutesLimit ?? null,
      dictionaryAiLimit: dto.dictionaryAiLimit ?? null,
      aiTextTokensLimit: dto.aiTextTokensLimit ?? null,
      memoryMbLimit: dto.memoryMbLimit ?? null,
    });
    return this.planRepo.save(plan);
  }

  /** Admin CSV for the accountant (manual e-barimt — spec decision 4). */
  async exportCsv(): Promise<string> {
    const rows = await this.findAll();
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = [
      'date',
      'payment_id',
      'user',
      'phone',
      'plan',
      'list_price',
      'discount',
      'amount',
      'status',
      'byl_checkout',
    ];
    const lines = rows.map((p) => {
      const m = (p.metadata ?? {}) as Partial<PlanMeta>;
      return [
        p.createdAt.toISOString(),
        p.id,
        p.user?.username ?? p.user?.fullName,
        p.user?.phone,
        m.planName,
        m.listPrice,
        m.discount,
        p.amount,
        m.mismatch ? 'mismatch' : p.status,
        p.providerRef,
      ]
        .map(esc)
        .join(',');
    });
    return [head.join(','), ...lines].join('\n');
  }

  /**
   * Admin: edit a plan. Limits apply at once to everyone on it (they are read
   * live); a new price only affects checkouts started after the edit.
   * `isActive = false` takes it off /checkout without touching paid access.
   */
  async updatePlan(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('План олдсонгүй');
    // Only the fields sent; `null` stays (= unlimited), `undefined` = untouched.
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    return this.planRepo.save(this.planRepo.merge(plan, changes));
  }
}
