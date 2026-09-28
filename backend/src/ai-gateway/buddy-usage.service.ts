import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsage } from '../entities/ai-usage.entity';
import { Plan } from '../entities/plan.entity';
import { User } from '../entities/user.entity';
import { AiUsageType } from '../common/enums';

/** Warning band for approaching the monthly voice cap. */
export type WarnLevel = 'none' | 'warn80' | 'warn95';

export interface Allowance {
  allowed: boolean;
  usedSeconds: number;
  /** null = unlimited (the plan in force has no cap). */
  limitSeconds: number | null;
  warnLevel: WarnLevel;
}

/**
 * Enforces the monthly voice caps that already exist as columns on `plans`
 * (voiceMinutesLimit / sttMinutesLimit) but were never enforced. Truth is the
 * ai_usages ledger (like XpLog for XP) — no extra counter columns on users.
 */
/** The plan whose caps apply to users with no active plan (shown as "Essential"). */
export const ESSENTIAL_PLAN_SLUG = 'standard';

type Caps = Pick<Plan, 'voiceMinutesLimit' | 'sttMinutesLimit'>;

/**
 * The caps in force: the user's plan while it is active, otherwise Essential's.
 *
 * Until 2026-09-28 a user with no plan — or an expired one — read `null` and
 * got UNLIMITED voice, the costliest thing the app does. The app already shows
 * those users as "Essential", so they get Essential's caps (voice cost brief:
 * STT 100 min, TTS 35 min — set on the `standard` plan row, admin-editable).
 */
export function capsInForce(
  user: Pick<User, 'plan' | 'planExpiresAt'>,
  essential: Caps | null,
  now = Date.now(),
): Caps {
  const active =
    user.plan && (!user.planExpiresAt || user.planExpiresAt.getTime() > now);
  if (active) return user.plan!;
  // No Essential row at all → keep the old behaviour rather than lock everyone out.
  return essential ?? { voiceMinutesLimit: null, sttMinutesLimit: null };
}

@Injectable()
export class BuddyUsageService {
  constructor(
    @InjectRepository(AiUsage)
    private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Plan)
    private readonly plans: Repository<Plan>,
  ) {}

  private async caps(user: User): Promise<Caps> {
    const active =
      user.plan &&
      (!user.planExpiresAt || user.planExpiresAt.getTime() > Date.now());
    if (active) return user.plan!;
    const essential = await this.plans.findOne({
      where: { slug: ESSENTIAL_PLAN_SLUG },
      select: { id: true, voiceMinutesLimit: true, sttMinutesLimit: true },
    });
    return capsInForce(user, essential);
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
    type: AiUsageType,
    limitMinutes: number | null,
  ): Promise<Allowance> {
    const usedSeconds = await this.monthlySeconds(user.id, type);
    const limitSeconds = limitMinutes === null ? null : limitMinutes * 60;
    const allowed = limitSeconds === null || usedSeconds < limitSeconds;
    return {
      allowed,
      usedSeconds,
      limitSeconds,
      warnLevel: this.band(usedSeconds, limitSeconds),
    };
  }
}
