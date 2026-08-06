import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { SparksLog } from '../entities/sparks-log.entity';
import { LessonUnlock } from '../entities/lesson-unlock.entity';
import { Lesson } from '../entities/lesson.entity';
import { User } from '../entities/user.entity';
import { SparksSource } from '../common/enums';

export interface AwardSparksOptions {
  userId: string;
  amount: number; // positive = earn, negative = spend
  source: SparksSource;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SparksService {
  constructor(
    @InjectRepository(LessonUnlock)
    private readonly unlocks: Repository<LessonUnlock>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Log a Sparks change and update the User.sparks cache atomically.
   * Positive amount = earn; negative = spend.
   *
   * **Spending is guarded here, not by the caller.** Callers check the balance
   * with a plain `SELECT` before opening their transaction, which is a
   * time-of-check/time-of-use race: two concurrent purchases of *different*
   * items both read the same balance, both pass, and both deduct — leaving the
   * user with a negative balance and items they could not afford. A unique
   * constraint does not help, because those are different rows.
   *
   * The conditional UPDATE below closes it: Postgres re-reads the row under a
   * row lock, so the second writer sees the first one's deduction and matches
   * zero rows. One guard in the shared ledger protects every spender.
   */
  async change(opts: AwardSparksOptions): Promise<SparksLog> {
    return this.dataSource.transaction(async (manager) => {
      const log = manager.create(SparksLog, {
        userId: opts.userId,
        amount: opts.amount,
        source: opts.source,
        referenceId: opts.referenceId ?? null,
        metadata: opts.metadata ?? null,
      });
      await manager.save(log);

      if (opts.amount >= 0) {
        await manager.increment(User, { id: opts.userId }, 'sparks', opts.amount);
      } else {
        await this.deduct(manager, opts.userId, Math.abs(opts.amount));
      }

      return log;
    });
  }

  /**
   * Subtract Sparks, but only if the balance actually covers it.
   *
   * Postgres re-reads the row under a row lock for the UPDATE, so a second
   * concurrent spender sees the first one's deduction and matches zero rows.
   * Throwing then rolls its whole transaction back — the ledger row and
   * whatever the caller was granting are undone together.
   */
  private async deduct(
    manager: EntityManager,
    userId: string,
    cost: number,
  ): Promise<void> {
    const res = await manager
      .createQueryBuilder()
      .update(User)
      .set({ sparks: () => 'sparks - :cost' })
      .where('id = :id AND sparks >= :cost', { id: userId, cost })
      .setParameter('cost', cost)
      .execute();

    if (!res.affected) {
      throw new BadRequestException('Spark хүрэлцэхгүй байна');
    }
  }

  /**
   * Unlock a lesson with Sparks.
   * - Checks the lesson exists and is paid (priceSparks > 0).
   * - Checks the user hasn't already unlocked it (idempotent guard).
   * - Checks the user's Sparks balance is sufficient.
   * - Deducts Sparks and creates LessonUnlock in one transaction.
   */
  async unlockLesson(userId: string, lessonId: string): Promise<LessonUnlock> {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Хичээл олдсонгүй');

    if (lesson.priceSparks === 0) {
      throw new BadRequestException('Энэ хичээл үнэгүй тул нээлт шаардахгүй');
    }

    // Check for existing unlock (unique constraint guard at service level too)
    const existing = await this.unlocks.findOne({
      where: { userId, lessonId },
    });
    if (existing) {
      throw new ConflictException('Та энэ хичээлийг аль хэдийн нээсэн байна');
    }

    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Хэрэглэгч олдсонгүй');

    if (user.sparks < lesson.priceSparks) {
      throw new BadRequestException(
        `Spark хүрэлцэхгүй байна. Шаардлагатай: ${lesson.priceSparks}, таны үлдэгдэл: ${user.sparks}`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Deduct Sparks
      const sparksLog = manager.create(SparksLog, {
        userId,
        amount: -lesson.priceSparks,
        source: SparksSource.LESSON_UNLOCK,
        referenceId: lessonId,
        metadata: { lessonTitle: lesson.title },
      });
      await manager.save(sparksLog);
      // Guarded: the balance check above ran outside this transaction, so a
      // concurrent spend could have emptied the account since.
      await this.deduct(manager, userId, lesson.priceSparks);

      // Create the unlock record
      const unlock = manager.create(LessonUnlock, {
        userId,
        lessonId,
        sparksSpent: lesson.priceSparks,
      });
      return manager.save(unlock);
    });
  }

  /** Check if a user has access to a lesson (free or already unlocked). */
  async hasAccess(userId: string, lessonId: string): Promise<boolean> {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) return false;
    if (lesson.priceSparks === 0) return true;

    const unlock = await this.unlocks.findOne({ where: { userId, lessonId } });
    return !!unlock;
  }
}
