import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import type Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import { REDIS_CLIENT } from '../redis/redis.module';
import { User } from '../entities/user.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AssignmentCompletion } from '../entities/assignment-completion.entity';
import { BuddyMemory } from '../entities/buddy-memory.entity';
import { BuddySession } from '../entities/buddy-session.entity';
import { ClassJoinRequest } from '../entities/class-join-request.entity';
import { LessonUnlock } from '../entities/lesson-unlock.entity';
import { Message } from '../entities/message.entity';
import { Payment } from '../entities/payment.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { SafetyEvent } from '../entities/safety-event.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { UserDictionarySave } from '../entities/user-dictionary-save.entity';
import { UserTrophy } from '../entities/user-trophy.entity';
import { WordReview } from '../entities/word-review.entity';
import { XpLog } from '../entities/xp-log.entity';

/**
 * Permanent, user-initiated account deletion.
 *
 * **Why this exists.** App Store Review Guideline 5.1.1(v) requires any app
 * that lets people create an account to let them delete it *from inside the
 * app*. An email-to-support flow is an automatic rejection.
 *
 * **Why every table is listed explicitly** instead of relying on
 * `ON DELETE CASCADE`. The entity decorators do declare CASCADE, but the
 * production schema was built by migrations while dev uses
 * `DB_SYNCHRONIZE=true` — the two are not guaranteed to agree, and a foreign
 * key that turns out to lack the clause would make deletion fail in production
 * only. Deleting the children ourselves works either way, and the list doubles
 * as the audit trail of what "delete my account" actually removes.
 *
 * ⚠️ **Adding a table with a user FK means adding it here**, or that row
 * survives its owner and the deletion silently stops being complete.
 */
@Injectable()
export class AccountDeletionService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Delete the caller's account and everything personal attached to it.
   *
   * The password is re-checked here even though the caller already holds a
   * valid token: a stolen or borrowed unlocked phone should not be able to
   * destroy someone's account in two taps.
   */
  async deleteOwnAccount(user: User, password: string): Promise<{ ok: true }> {
    const fresh = await this.dataSource
      .getRepository(User)
      .findOne({ where: { id: user.id }, select: { id: true, email: true, passwordHash: true } });

    if (!fresh || !(await bcrypt.compare(password, fresh.passwordHash))) {
      throw new UnauthorizedException('Нууц үг буруу байна');
    }

    await this.dataSource.transaction((manager) => this.purge(manager, user.id));
    await this.clearRedis(user.id, fresh.email);

    return { ok: true };
  }

  /** Everything is one transaction: a half-deleted account is worse than none. */
  private async purge(manager: EntityManager, userId: string): Promise<void> {
    // 1. Rows that belong to the user and carry no value once they are gone.
    for (const entity of [
      AiUsage,
      BuddyMemory,
      BuddySession,
      LessonUnlock,
      Message,
      QuizAttempt,
      SafetyEvent,
      SparksLog,
      UserDictionarySave,
      UserTrophy,
      WordReview,
      XpLog,
    ]) {
      await manager.delete(entity, { userId });
    }

    // 2. Same idea, but these name the column `student_id`.
    await manager.delete(AssignmentCompletion, { studentId: userId });
    await manager.delete(ClassJoinRequest, { studentId: userId });

    // 3. Class membership lives in a join table with no entity of its own.
    await manager.query('DELETE FROM class_students WHERE student_id = $1', [userId]);

    // 4. DETACHED, not deleted.
    //    - payments: a financial record has to outlive the account (accounting,
    //      refunds, disputes). The column is nullable for exactly this.
    //    - classes: a teacher leaving must not delete their students' class.
    //    - referred_by: other people's accounts must not be touched.
    await manager.update(Payment, { userId }, { userId: null });
    await manager.query('UPDATE classes SET teacher_id = NULL WHERE teacher_id = $1', [userId]);
    await manager.query('UPDATE users SET referred_by_id = NULL WHERE referred_by_id = $1', [userId]);

    // 5. Finally the account itself.
    await manager.delete(User, { id: userId });
  }

  /**
   * Drop the cached state keyed by this user. Best-effort: the account is
   * already gone from Postgres, so a Redis hiccup must not turn a successful
   * deletion into an error the user sees.
   *
   * `reviewxp:{userId}:{wordId}:{day}` is deliberately not scanned for — those
   * keys expire on their own within the day, and a SCAN across production
   * Redis for every deletion is a worse trade than waiting for the TTL.
   */
  private async clearRedis(userId: string, email: string): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const lower = email.toLowerCase();
    try {
      await this.redis.del(
        `streak:seen:${userId}`,
        `ai:daily:msg:${userId}:${today}`,
        `ai:daily:tokens:${userId}:${today}`,
        `ai:daily:voice:${userId}:${today}`,
        `otp:verify:${lower}`,
        `otp:reset:${lower}`,
        `referral:pending:${lower}`,
        `taste:pending:${lower}`,
      );
    } catch {
      // Non-critical — see the doc comment.
    }
  }
}
