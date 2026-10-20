import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsage } from '../entities/ai-usage.entity';
import { Plan } from '../entities/plan.entity';
import { User } from '../entities/user.entity';
import { VoiceCredit } from '../entities/voice-credit.entity';
import { AiUsageType } from '../common/enums';
import { resolvePlan } from '../common/plan-in-force';

/** Warning band for approaching the monthly voice cap. */
export type WarnLevel = 'none' | 'warn80' | 'warn95';

export interface Allowance {
  allowed: boolean;
  usedSeconds: number;
  /** Plan cap + pay-as-you-go balance; null = unlimited (no cap in force). */
  limitSeconds: number | null;
  warnLevel: WarnLevel;
}

type VoiceType = AiUsageType.TTS | AiUsageType.STT;

/**
 * Effective monthly cap with pay-as-you-go seconds on top. Seconds already
 * taken from the balance this month are part of `used` past the plan cap,
 * hence `max(limit, used)`: remaining = plan headroom + balance.
 */
export function capWithCredits(
  usedSeconds: number,
  limitSeconds: number | null,
  creditSeconds: number,
): number | null {
  if (limitSeconds === null) return null;
  return Math.max(limitSeconds, usedSeconds) + Math.max(0, creditSeconds);
}

/** Part of a just-logged usage that fell past the plan cap (to pay from credits). */
export function secondsPastCap(
  usedAfter: number,
  seconds: number,
  limitSeconds: number,
): number {
  const before = usedAfter - seconds;
  return Math.max(0, usedAfter - limitSeconds) - Math.max(0, before - limitSeconds);
}

/**
 * Enforces the monthly voice caps that already exist as columns on `plans`
 * (voiceMinutesLimit / sttMinutesLimit). Truth is the ai_usages ledger (like
 * XpLog for XP) — no extra counter columns on users. Which plan's caps apply
 * (own plan, else the Free row) is decided by `resolvePlan`.
 */
@Injectable()
export class BuddyUsageService {
  private readonly logger = new Logger(BuddyUsageService.name);

  constructor(
    @InjectRepository(AiUsage)
    private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(VoiceCredit)
    private readonly credits: Repository<VoiceCredit>,
  ) {}

  /** null caps = unlimited (no plan in force, i.e. the Free row is missing). */
  private async caps(user: User) {
    const plan = await resolvePlan(user, this.plans);
    return {
      voiceMinutesLimit: plan?.voiceMinutesLimit ?? null,
      sttMinutesLimit: plan?.sttMinutesLimit ?? null,
    };
  }

  /** Sum of voice_seconds for one AiUsageType in the current calendar month. */
  private async monthlySeconds(
    userId: string,
    type: AiUsageType,
  ): Promise<number> {
    const row = await this.aiUsages
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.voice_seconds), 0)', 'sum')
      .where('u.user_id = :userId', { userId })
      .andWhere('u.type = :type', { type })
      .andWhere("u.created_at >= date_trunc('month', now())")
      .getRawOne<{ sum: string }>();
    return parseInt(row?.sum ?? '0', 10);
  }

  /** Pay-as-you-go balance in seconds (bought minus spent). */
  async creditSeconds(userId: string, type: VoiceType): Promise<number> {
    const row = await this.credits
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.seconds), 0)', 'sum')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.type = :type', { type })
      .getRawOne<{ sum: string }>();
    return parseInt(row?.sum ?? '0', 10);
  }

  /**
   * Call right after a TTS/STT usage row is saved: whatever part of it went
   * past the monthly plan cap is taken from the pay-as-you-go balance.
   * Never throws — a ledger hiccup must not fail a turn the user already had.
   */
  async spendCredits(
    userId: string,
    type: VoiceType,
    seconds: number,
  ): Promise<void> {
    if (seconds <= 0) return;
    try {
      // Most users own no credits: one indexed SUM and out.
      const balance = await this.creditSeconds(userId, type);
      if (balance <= 0) return;
      const user = await this.users.findOne({
        where: { id: userId },
        relations: ['plan'],
      });
      if (!user) return;
      const caps = await this.caps(user);
      const limitMin =
        type === AiUsageType.TTS ? caps.voiceMinutesLimit : caps.sttMinutesLimit;
      if (limitMin === null) return;
      const used = await this.monthlySeconds(userId, type);
      const take = Math.min(balance, secondsPastCap(used, seconds, limitMin * 60));
      if (take > 0)
        await this.credits.save(
          this.credits.create({ userId, type, seconds: -take, paymentId: null }),
        );
    } catch (err) {
      this.logger.warn(`spendCredits failed for ${userId}: ${String(err)}`);
    }
  }

  private band(used: number, limit: number | null): WarnLevel {
    if (limit === null || limit <= 0) return 'none';
    const ratio = used / limit;
    if (ratio >= 0.95) return 'warn95';
    if (ratio >= 0.8) return 'warn80';
    return 'none';
  }

  /** TTS (voice-out) allowance for this month. */
  async checkVoice(user: User): Promise<Allowance> {
    return this.check(
      user,
      AiUsageType.TTS,
      (await this.caps(user)).voiceMinutesLimit,
    );
  }

  /** STT (speech-in) allowance for this month. */
  async checkStt(user: User): Promise<Allowance> {
    return this.check(
      user,
      AiUsageType.STT,
      (await this.caps(user)).sttMinutesLimit,
    );
  }

  private async check(
    user: User,
    type: VoiceType,
    limitMinutes: number | null,
  ): Promise<Allowance> {
    const [usedSeconds, credit] = await Promise.all([
      this.monthlySeconds(user.id, type),
      limitMinutes === null ? 0 : this.creditSeconds(user.id, type),
    ]);
    const limitSeconds = capWithCredits(
      usedSeconds,
      limitMinutes === null ? null : limitMinutes * 60,
      credit,
    );
    const allowed = limitSeconds === null || usedSeconds < limitSeconds;
    return {
      allowed,
      usedSeconds,
      limitSeconds,
      warnLevel: this.band(usedSeconds, limitSeconds),
    };
  }
}
