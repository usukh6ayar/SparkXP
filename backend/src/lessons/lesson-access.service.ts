import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { LessonUnlock } from '../entities/lesson-unlock.entity';
import { Lesson } from '../entities/lesson.entity';
import { User } from '../entities/user.entity';
import { LessonUnlockSource } from '../common/enums';
import { AssignmentsService } from '../assignments/assignments.service';

/** Lessons a free-tier student may open for themselves, for the lifetime of the account. */
export const FREE_LESSON_QUOTA = 3;

/** Why a student can (or cannot) open a lesson. Drives the copy the app shows. */
export type AccessReason =
  | 'plan' // active subscription — everything is open
  | 'unlocked' // already opened before, by any route
  | 'assignment' // teacher homework — always free
  | 'free_lesson' // lesson costs nothing and the quota is off
  | 'locked'; // needs a free right, or a plan

export interface LessonAccess {
  hasAccess: boolean;
  reason: AccessReason;
  /**
   * True when `POST /lessons/:id/open` would succeed — the student either has
   * homework here or still has a free right. Lets the app show "Эхлэх" instead
   * of "Багц авах" without duplicating the rule.
   */
  canOpen: boolean;
  /** Free rights left. `null` when the quota is switched off. */
  freeRemaining: number | null;
  /** The quota in force. `null` when switched off. */
  freeQuota: number | null;
}

/**
 * Decides whether a student may watch a lesson.
 *
 * **The rule lives here and only here.** The app is never trusted to decide —
 * a client-side paywall is a paywall with an off switch — so the lesson's
 * content is also stripped from the API response when this service says no.
 *
 * Order of precedence:
 *   1. active subscription  → every lesson
 *   2. an existing unlock   → that lesson, forever
 *   3. teacher homework     → free, and never counted against the quota
 *   4. a free right left    → openable, once the student confirms
 *   5. otherwise            → locked
 */
@Injectable()
export class LessonAccessService {
  constructor(
    @InjectRepository(LessonUnlock)
    private readonly unlocks: Repository<LessonUnlock>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly assignments: AssignmentsService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * The quota is OFF by default, and must stay off until QPay works.
   *
   * Locking students out while there is no way to take their money would just
   * lose them — `PAYMENTS_ENABLED` is still false (see CLAUDE.md). Fail-closed
   * on the flag: only the exact string 'true' enables it.
   */
  private quotaEnabled(): boolean {
    return this.config.get<string>('FREE_LESSON_QUOTA_ENABLED') === 'true';
  }

  /** Does this user hold a subscription that has not expired? */
  private async hasActivePlan(userId: string): Promise<boolean> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, planId: true, planExpiresAt: true },
    });
    if (!user?.planId) return false;
    // A plan with no expiry is treated as active — admin-granted accounts.
    return !user.planExpiresAt || user.planExpiresAt.getTime() > Date.now();
  }

  private countFreeUsed(userId: string): Promise<number> {
    return this.unlocks.count({
      where: { userId, source: LessonUnlockSource.FREE },
    });
  }

  /** Read-only: what this user may do with this lesson right now. */
  async getAccess(userId: string, lessonId: string): Promise<LessonAccess> {
    const lesson = await this.lessons.findOne({
      where: { id: lessonId },
      select: { id: true, priceSparks: true },
    });
    if (!lesson) throw new NotFoundException('Хичээл олдсонгүй');

    const unlocked = await this.unlocks.findOne({
      where: { userId, lessonId },
      select: { id: true },
    });

    // Quota off → the original Sparks-only behaviour, unchanged.
    if (!this.quotaEnabled()) {
      const open = lesson.priceSparks === 0 || !!unlocked;
      return {
        hasAccess: open,
        reason: unlocked ? 'unlocked' : open ? 'free_lesson' : 'locked',
        canOpen: false, // Sparks purchase has its own endpoint
        freeRemaining: null,
        freeQuota: null,
      };
    }

    const freeUsed = await this.countFreeUsed(userId);
    const freeRemaining = Math.max(0, FREE_LESSON_QUOTA - freeUsed);
    const base = { freeRemaining, freeQuota: FREE_LESSON_QUOTA };

    if (unlocked) {
      return { hasAccess: true, reason: 'unlocked', canOpen: false, ...base };
    }
    if (await this.hasActivePlan(userId)) {
      return { hasAccess: true, reason: 'plan', canOpen: false, ...base };
    }
    // Homework is checked before the quota so it never costs a right.
    // `hasAccess` is still false — the student has not opened it yet — but the
    // reason lets the app say "Багшийн даалгавар — үнэгүй" instead of showing a
    // free-lessons-remaining counter that this lesson will not decrement.
    if (await this.assignments.isAssignedLesson(userId, lessonId)) {
      return { hasAccess: false, reason: 'assignment', canOpen: true, ...base };
    }
    return {
      hasAccess: false,
      reason: 'locked',
      canOpen: freeRemaining > 0,
      ...base,
    };
  }

  /**
   * May this caller receive the lesson's `content` (the video URL and the rest
   * of the paid material)?
   *
   * This is the half of the paywall that actually holds: without it the app
   * could simply skip the lock screen, or anyone could curl the public
   * `GET /lessons/:id`.
   *
   * `userId` is null for anonymous callers — the route stays public so the
   * lesson's title and description remain readable.
   */
  async canSeeContent(userId: string | null, lessonId: string): Promise<boolean> {
    if (this.quotaEnabled()) {
      // With the quota live, content is for signed-in users who have access.
      return userId ? (await this.getAccess(userId, lessonId)).hasAccess : false;
    }

    // Quota off → exactly the pre-existing rule, so nothing changes today.
    const lesson = await this.lessons.findOne({
      where: { id: lessonId },
      select: { id: true, priceSparks: true },
    });
    if (!lesson) return false;
    if (lesson.priceSparks === 0) return true;
    if (!userId) return false;
    return !!(await this.unlocks.findOne({
      where: { userId, lessonId },
      select: { id: true },
    }));
  }

  /**
   * Open a lesson for this student — the "Эхлэх" tap.
   *
   * Idempotent: opening an already-open lesson is a no-op, so a double tap or
   * a retried request can never burn a second right.
   *
   * Assigned homework is granted free; otherwise one of the three rights is
   * spent. Both are recorded as an unlock row so the access survives the
   * teacher later deleting the assignment.
   */
  async open(userId: string, lessonId: string): Promise<LessonAccess> {
    const current = await this.getAccess(userId, lessonId);
    if (current.hasAccess || !this.quotaEnabled()) return current;

    const assigned = await this.assignments.isAssignedLesson(userId, lessonId);
    if (!assigned && current.freeRemaining === 0) {
      throw new ForbiddenException(
        'Үнэгүй хичээлийн эрх дууссан байна. Багц авна уу.',
      );
    }

    const source = assigned
      ? LessonUnlockSource.ASSIGNMENT
      : LessonUnlockSource.FREE;

    // The quota check above and the insert below are two statements, so two
    // parallel taps could each see "1 right left" and both spend it. Re-count
    // INSIDE the transaction after inserting and roll back if that put the
    // student over the limit — the DB, not the request order, decides.
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .insert()
        .into(LessonUnlock)
        .values({ userId, lessonId, source, sparksSpent: null })
        .orIgnore() // unique (user, lesson) — a repeat open is not an error
        .execute();

      if (source === LessonUnlockSource.FREE) {
        const used = await manager.count(LessonUnlock, {
          where: { userId, source: LessonUnlockSource.FREE },
        });
        if (used > FREE_LESSON_QUOTA) {
          throw new ForbiddenException(
            'Үнэгүй хичээлийн эрх дууссан байна. Багц авна уу.',
          );
        }
      }
    });

    return this.getAccess(userId, lessonId);
  }
}
