import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { User } from '../entities/user.entity';
import { PaymentStatus, SparksSource } from '../common/enums';
import { CreatePaymentDto, SPARKS_PACKAGES } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Plan)
    private readonly planRepo: Repository<Plan>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a PENDING payment for either a Sparks package or a subscription
   * plan, and returns a QPay stub URL. Real QPay swaps this stub.
   */
  async createIntent(dto: CreatePaymentDto, user: User) {
    let amount: number;
    let metadata: Record<string, unknown>;

    if (dto.planId) {
      // --- Subscription plan purchase ---
      const plan = await this.planRepo.findOne({ where: { id: dto.planId, isActive: true } });
      if (!plan) throw new NotFoundException('Plan not found or inactive');
      amount = plan.priceAmount;
      metadata = { type: 'plan', planId: plan.id, planName: plan.name, durationDays: plan.durationDays };
    } else if (dto.amount) {
      // --- Sparks top-up ---
      const pkg = SPARKS_PACKAGES.find((p) => p.amount === dto.amount);
      if (!pkg) {
        throw new BadRequestException(
          `Invalid amount. Valid Sparks packages: ${SPARKS_PACKAGES.map((p) => p.amount).join(', ')} MNT`,
        );
      }
      amount = dto.amount;
      metadata = { type: 'sparks', sparksToCredit: pkg.sparks };
    } else {
      throw new BadRequestException('Provide either planId or amount');
    }

    const payment = this.paymentRepo.create({
      userId: user.id,
      amount,
      currency: 'MNT',
      provider: dto.provider ?? 'qpay',
      status: PaymentStatus.PENDING,
      metadata,
    });
    await this.paymentRepo.save(payment);

    // TODO: call real QPay API here — store providerRef, return QR/deep-link URL
    return {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      metadata: payment.metadata,
      paymentUrl: `https://qpay.mn/payment/stub/${payment.id}`,
      status: payment.status,
    };
  }

  /**
   * Confirms a payment after QPay callback or manual confirmation.
   * - Sparks purchase  → credits Sparks to user
   * - Plan purchase    → sets user.planId + user.planExpiresAt
   */
  async confirm(paymentId: string, dto: ConfirmPaymentDto, caller: User) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment || payment.userId !== caller.id) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) throw new ConflictException('Already confirmed');
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Cannot confirm in current state');
    }

    const type = payment.metadata?.type as string;

    await this.dataSource.transaction(async (manager) => {
      payment.status = PaymentStatus.PAID;
      payment.providerRef = dto.providerRef;
      await manager.save(Payment, payment);

      if (type === 'sparks') {
        const sparks = (payment.metadata?.sparksToCredit as number) ?? 0;
        if (sparks > 0) {
          const log = manager.create(SparksLog, {
            userId: caller.id,
            amount: sparks,
            source: SparksSource.PURCHASE,
            refId: payment.id,
          });
          await manager.save(SparksLog, log);
          await manager.increment(User, { id: caller.id }, 'sparks', sparks);
        }
      } else if (type === 'plan') {
        const planId = payment.metadata?.planId as string;
        const days = (payment.metadata?.durationDays as number) ?? 30;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + days);
        await manager.update(User, { id: caller.id }, { planId, planExpiresAt: expiresAt });
      }
    });

    return { message: 'Payment confirmed', type, paymentId };
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
  async createPlan(dto: import('./dto/create-plan.dto').CreatePlanDto): Promise<Plan> {
    const plan = this.planRepo.create({
      name: dto.name,
      slug: dto.slug,
      priceAmount: dto.priceAmount,
      durationDays: dto.durationDays,
      features: dto.features ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.planRepo.save(plan);
  }
}
