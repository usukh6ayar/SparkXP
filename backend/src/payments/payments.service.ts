import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Payment } from '../entities/payment.entity';
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
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Creates a PENDING payment record and returns a payment URL / QR stub.
   * Real QPay integration swaps this stub for a live QPay API call.
   */
  async createIntent(dto: CreatePaymentDto, user: User) {
    const pkg = SPARKS_PACKAGES.find((p) => p.amount === dto.amount);
    if (!pkg) {
      throw new BadRequestException(
        `Invalid package. Valid amounts: ${SPARKS_PACKAGES.map((p) => p.amount).join(', ')} MNT`,
      );
    }

    const payment = this.paymentRepo.create({
      userId: user.id,
      amount: dto.amount,
      currency: 'MNT',
      provider: dto.provider ?? 'qpay',
      status: PaymentStatus.PENDING,
      metadata: { sparksToCredit: pkg.sparks },
    });
    await this.paymentRepo.save(payment);

    // TODO: call real QPay API here and store providerRef + return payment URL
    return {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      sparksToCredit: pkg.sparks,
      // Stub: in production replace with QPay deep-link / QR code URL
      paymentUrl: `https://qpay.mn/payment/stub/${payment.id}`,
      status: payment.status,
    };
  }

  /**
   * Confirms a payment (called after QPay webhook or manual confirmation).
   * Credits Sparks to the user in one atomic transaction.
   */
  async confirm(paymentId: string, dto: ConfirmPaymentDto, caller: User) {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== caller.id) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.PAID) {
      throw new ConflictException('Payment already confirmed');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment cannot be confirmed in its current state');
    }

    const sparksToCredit = (payment.metadata?.sparksToCredit as number) ?? 0;

    await this.dataSource.transaction(async (manager) => {
      payment.status = PaymentStatus.PAID;
      payment.providerRef = dto.providerRef;
      await manager.save(Payment, payment);

      if (sparksToCredit > 0) {
        const log = manager.create(SparksLog, {
          userId: caller.id,
          amount: sparksToCredit,
          source: SparksSource.PURCHASE,
          refId: payment.id,
        });
        await manager.save(SparksLog, log);
        await manager.increment(User, { id: caller.id }, 'sparks', sparksToCredit);
      }
    });

    return { message: `Payment confirmed. ${sparksToCredit} Sparks credited.` };
  }

  /** User's own payment history. */
  findMy(user: User): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
    });
  }

  /** Admin: all payments, optional filter by status. */
  findAll(): Promise<Payment[]> {
    return this.paymentRepo.find({ order: { createdAt: 'DESC' } });
  }
}
