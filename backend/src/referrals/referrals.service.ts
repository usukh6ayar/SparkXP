import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository, EntityManager } from 'typeorm';
import { User } from '../entities/user.entity';
import { XpLog } from '../entities/xp-log.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { XpSource, SparksSource } from '../common/enums';
import { XpService } from '../xp/xp.service';
import {
  REFERRAL,
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_CODE_PREFIX,
} from './referrals.constants';

/** Shape returned by GET /referrals/me — powers the mobile invite screen. */
export interface MyReferral {
  referralCode: string;
  username: string | null;
  invitedCount: number;
  totalXpEarned: number;
  totalSparksEarned: number;
}

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(XpLog)
    private readonly xpLogs: Repository<XpLog>,
    @InjectRepository(SparksLog)
    private readonly sparksLogs: Repository<SparksLog>,
    private readonly xp: XpService,
  ) {}

  /** The caller's referral code + reward tally (generates a code on first use). */
  async getMyReferral(userId: string): Promise<MyReferral> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, username: true, referralCode: true },
    });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    const referralCode = user.referralCode ?? (await this.ensureReferralCode(user.id));

    const [invitedCount, xpRow, sparksRow] = await Promise.all([
      this.users.count({ where: { referredById: userId } }),
      this.xpLogs
        .createQueryBuilder('x')
        .select('COALESCE(SUM(x.amount), 0)', 'sum')
        .where('x.user_id = :userId', { userId })
        .andWhere('x.source = :src', { src: XpSource.REFERRAL })
        .getRawOne<{ sum: string }>(),
      this.sparksLogs
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.amount), 0)', 'sum')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.source = :src', { src: SparksSource.REFERRAL })
        .andWhere('s.amount > 0')
        .getRawOne<{ sum: string }>(),
    ]);

    return {
      referralCode,
      username: user.username,
      invitedCount,
      totalXpEarned: Number(xpRow?.sum ?? 0),
      totalSparksEarned: Number(sparksRow?.sum ?? 0),
    };
  }

  /**
   * Consume a referral code at email-verification time: link the new user to the
   * inviter (once) and award both the signup XP. Safe to call with a null/blank
   * code (no-op). Callers should still guard with try/catch so a referral hiccup
   * never blocks verification.
   */
  async applyReferralOnVerify(newUser: User, rawCode: string | null): Promise<void> {
    const raw = rawCode?.trim();
    if (!raw) return;
    if (newUser.referredById) return; // already referred — set once

    // Resolve the inviter by their referral code OR username (case-insensitive).
    // Usernames can't contain '-' and codes always do, so there's no overlap.
    const inviter = await this.users.findOne({
      where: [{ referralCode: ILike(raw) }, { username: ILike(raw) }],
      select: { id: true },
    });
    if (!inviter || inviter.id === newUser.id) return; // unknown code / self-referral

    await this.users.update(newUser.id, { referredById: inviter.id });

    // referenceId cross-links the pair so each side is paid exactly once.
    const rewards = await this.xp.rewards();
    await this.xp.awardOnce({
      userId: newUser.id,
      amount: rewards.referralInvitee,
      source: XpSource.REFERRAL,
      referenceId: inviter.id,
    });
    await this.xp.awardOnce({
      userId: inviter.id,
      amount: rewards.referralInviter,
      source: XpSource.REFERRAL,
      referenceId: newUser.id,
    });
  }

  /**
   * Credit the inviter their Sparks bonus for a referred friend's first
   * purchase. Runs inside the caller's payment transaction (takes the manager)
   * so it's atomic with the payment. Idempotent: pays at most once per buyer.
   */
  async creditFirstPurchaseBonus(manager: EntityManager, buyerId: string): Promise<void> {
    const buyer = await manager.findOne(User, {
      where: { id: buyerId },
      select: { id: true, referredById: true },
    });
    if (!buyer?.referredById) return; // buyer wasn't referred

    const already = await manager.findOne(SparksLog, {
      where: {
        userId: buyer.referredById,
        source: SparksSource.REFERRAL,
        referenceId: buyerId,
      },
      select: { id: true },
    });
    if (already) return; // inviter already rewarded for this friend

    const log = manager.create(SparksLog, {
      userId: buyer.referredById,
      amount: REFERRAL.FIRST_PURCHASE_SPARKS,
      source: SparksSource.REFERRAL,
      referenceId: buyerId,
    });
    await manager.save(SparksLog, log);
    await manager.increment(User, { id: buyer.referredById }, 'sparks', REFERRAL.FIRST_PURCHASE_SPARKS);
  }

  /** Assign a fresh unique referral code to a user who doesn't have one yet. */
  private async ensureReferralCode(userId: string): Promise<string> {
    const code = await this.generateUniqueCode();
    await this.users.update(userId, { referralCode: code });
    return code;
  }

  /** Generate a short, collision-checked referral code (e.g. "SPARK-7K2Q9"). */
  private async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      let body = '';
      for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
        body += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)];
      }
      const code = REFERRAL_CODE_PREFIX + body;
      const exists = await this.users.findOne({ where: { referralCode: code }, select: { id: true } });
      if (!exists) return code;
    }
    throw new Error('Could not generate a unique referral code');
  }
}
