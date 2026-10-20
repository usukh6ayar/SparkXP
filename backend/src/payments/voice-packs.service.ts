import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { VoicePack } from '../entities/voice-pack.entity';
import { VoiceCredit } from '../entities/voice-credit.entity';
import { AiUsageType, PaymentStatus } from '../common/enums';
import { CreateVoicePackDto, UpdateVoicePackDto } from './dto/voice-pack.dto';
import { paymentError } from './payments-errors';

/** `payments.metadata` of a pack purchase. `planName` = pack name, so the
 *  success page, admin list and CSV show it without a special case. */
export interface PackMeta {
  type: 'voice_pack';
  packId: string;
  packSlug: string;
  planName: string;
  voiceMinutes: number;
  sttMinutes: number;
  listPrice: number;
  mismatch?: boolean;
}

/**
 * Pay-as-you-go AI Buddy minutes: the packs (admin CRUD) and what a paid pack
 * grants. Checkout and the webhook stay in PaymentsService (shared with plans);
 * spending the balance lives in BuddyUsageService.
 */
@Injectable()
export class VoicePacksService {
  constructor(
    @InjectRepository(VoicePack) private readonly packs: Repository<VoicePack>,
    private readonly dataSource: DataSource,
  ) {}

  /** Public: every pack (the website shows the active ones). */
  findAll(): Promise<VoicePack[]> {
    return this.packs.find({ order: { priceAmount: 'ASC' } });
  }

  create(dto: CreateVoicePackDto): Promise<VoicePack> {
    return this.packs.save(this.packs.create({ ...dto, isActive: dto.isActive ?? true }));
  }

  /** Price edits only affect checkouts started afterwards. */
  async update(id: string, dto: UpdateVoicePackDto): Promise<VoicePack> {
    const pack = await this.packs.findOne({ where: { id } });
    if (!pack) throw new NotFoundException('Минутын багц олдсонгүй');
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    return this.packs.save(this.packs.merge(pack, changes));
  }

  async activePack(id: string): Promise<VoicePack> {
    const pack = await this.packs.findOne({ where: { id, isActive: true } });
    if (!pack)
      throw paymentError(HttpStatus.NOT_FOUND, 'PACK_NOT_FOUND', 'Минутын багц олдсонгүй');
    return pack;
  }

  meta(pack: VoicePack): PackMeta {
    return {
      type: 'voice_pack',
      packId: pack.id,
      packSlug: pack.slug,
      planName: pack.name,
      voiceMinutes: pack.voiceMinutes,
      sttMinutes: pack.sttMinutes,
      listPrice: pack.priceAmount,
    };
  }

  /**
   * Webhook-verified payment → credit the minutes. Uses the minutes recorded
   * at checkout, so an admin edit in between never changes what was paid for.
   * No referral bonus here: a cheap pack must not farm first-purchase rewards.
   */
  async grant(payment: Payment, meta: PackMeta): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      payment.status = PaymentStatus.PAID;
      await manager.save(Payment, payment);
      const rows = [
        { type: AiUsageType.TTS, minutes: meta.voiceMinutes },
        { type: AiUsageType.STT, minutes: meta.sttMinutes },
      ] as const;
      for (const { type, minutes } of rows)
        if (minutes > 0)
          await manager.save(VoiceCredit, {
            userId: payment.userId!,
            type,
            seconds: minutes * 60,
            paymentId: payment.id,
          });
    });
  }
}
