import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BuddySessionMode, XpSource } from '../common/enums';
import { BuddySession } from '../entities/buddy-session.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { User } from '../entities/user.entity';
import { UserTrophy } from '../entities/user-trophy.entity';
import { WordReview } from '../entities/word-review.entity';
import { XpLog } from '../entities/xp-log.entity';
import type { Skill } from '../teacher/skill';
import { ConditionType, TrophyStats } from './conditions';

/**
 * Zeroed stats — anything the caller didn't ask for stays at 0.
 *
 * A function, not a shared constant: the keyed fields are objects, so a spread
 * of a constant would hand every call the SAME nested objects and one user's
 * counts would leak into the next user's evaluation.
 */
function emptyStats(): TrophyStats {
  return {
    xpTotal: 0,
    sparksTotal: 0,
    streakDays: 0,
    trophyCount: 0,
    xpEvents: {},
    quizCount: {},
    quizPerfect: {},
    wordsLearned: 0,
    wordsMature: 0,
    wordsSaved: 0,
    cardsSwiped: 0,
    mistakesFixed: 0,
    buddySessions: {},
    buddyDistinct: 0,
  };
}

/** Which stats come from one shared query, so we run it at most once. */
const USER_ROW_TYPES: ConditionType[] = [
  'xp_total',
  'sparks_total',
  'streak_days',
];
const WORD_TYPES: ConditionType[] = [
  'words_learned',
  'words_mature',
  'words_saved',
  'cards_swiped',
  'mistakes_fixed',
];

/**
 * Loads the progress numbers trophy conditions compare against.
 *
 * Only the requested slice is queried: a quiz award never runs the vocabulary
 * aggregates. Definitions deliberately match the ones already in the codebase
 * rather than inventing a third — see `words_learned` / `words_mature` below.
 */
@Injectable()
export class TrophyStatsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(XpLog) private readonly xpLogs: Repository<XpLog>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(WordReview)
    private readonly reviews: Repository<WordReview>,
    @InjectRepository(BuddySession)
    private readonly sessions: Repository<BuddySession>,
    @InjectRepository(UserTrophy)
    private readonly trophies: Repository<UserTrophy>,
  ) {}

  async load(userId: string, types: ConditionType[]): Promise<TrophyStats> {
    const want = new Set(types);
    const need = (group: ConditionType[]) => group.some((t) => want.has(t));
    const stats = emptyStats();

    await Promise.all([
      need(USER_ROW_TYPES) ? this.loadUserRow(userId, stats) : null,
      want.has('trophy_count') ? this.loadTrophyCount(userId, stats) : null,
      want.has('xp_events') ? this.loadXpEvents(userId, stats) : null,
      want.has('quiz_count') || want.has('quiz_perfect')
        ? this.loadQuizzes(userId, stats)
        : null,
      need(WORD_TYPES) ? this.loadWords(userId, stats) : null,
      want.has('buddy_sessions') ? this.loadBuddySessions(userId, stats) : null,
      want.has('buddy_distinct') ? this.loadBuddyDistinct(userId, stats) : null,
    ]);

    return stats;
  }

  private async loadUserRow(userId: string, out: TrophyStats): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, xp: true, sparks: true, longestStreak: true },
    });
    out.xpTotal = user?.xp ?? 0;
    out.sparksTotal = user?.sparks ?? 0;
    // longest, not current: a trophy already earned is never taken back.
    out.streakDays = user?.longestStreak ?? 0;
  }

  private async loadTrophyCount(
    userId: string,
    out: TrophyStats,
  ): Promise<void> {
    out.trophyCount = await this.trophies.count({ where: { userId } });
  }

  private async loadXpEvents(userId: string, out: TrophyStats): Promise<void> {
    const rows = await this.xpLogs
      .createQueryBuilder('x')
      .select('x.source', 'source')
      .addSelect('COUNT(*)::int', 'n')
      .where('x.user_id = :userId', { userId })
      .groupBy('x.source')
      .getRawMany<{ source: XpSource; n: number }>();
    for (const r of rows) out.xpEvents[r.source] = Number(r.n);
  }

  /** One grouped pass gives both the per-skill and the total counts. */
  private async loadQuizzes(userId: string, out: TrophyStats): Promise<void> {
    const rows = await this.attempts
      .createQueryBuilder('a')
      .select('a.skill', 'skill')
      .addSelect('COUNT(*)::int', 'n')
      .addSelect('COUNT(*) FILTER (WHERE a.score_pct = 100)::int', 'perfect')
      .where('a.user_id = :userId', { userId })
      .groupBy('a.skill')
      .getRawMany<{ skill: Skill | null; n: number; perfect: number }>();

    let total = 0;
    let totalPerfect = 0;
    for (const r of rows) {
      const skill = (r.skill ?? 'other') as Skill;
      out.quizCount[skill] = Number(r.n);
      out.quizPerfect[skill] = Number(r.perfect);
      total += Number(r.n);
      totalPerfect += Number(r.perfect);
    }
    out.quizCount.total = total;
    out.quizPerfect.total = totalPerfect;
  }

  /**
   * `word_reviews` is unique per (user, word), so COUNT(*) is distinct words
   * touched — NOT swipes. Swipes are SUM(review_count).
   */
  private async loadWords(userId: string, out: TrophyStats): Promise<void> {
    const row = await this.reviews
      .createQueryBuilder('r')
      // repetitions >= 1 = "known", matching reviews.service.ts
      .select('COUNT(*) FILTER (WHERE r.repetitions >= 1)::int', 'learned')
      // interval_days >= 21 = "mature", matching teacher/progress.service.ts
      .addSelect('COUNT(*) FILTER (WHERE r.interval_days >= 21)::int', 'mature')
      .addSelect('COUNT(*) FILTER (WHERE r.saved)::int', 'saved')
      .addSelect('COALESCE(SUM(r.review_count), 0)::int', 'swiped')
      .addSelect(
        'COUNT(*) FILTER (WHERE r.wrong_count > 0 AND r.repetitions >= 1)::int',
        'fixed',
      )
      .where('r.user_id = :userId', { userId })
      .getRawOne<{
        learned: number;
        mature: number;
        saved: number;
        swiped: number;
        fixed: number;
      }>();

    out.wordsLearned = Number(row?.learned ?? 0);
    out.wordsMature = Number(row?.mature ?? 0);
    out.wordsSaved = Number(row?.saved ?? 0);
    out.cardsSwiped = Number(row?.swiped ?? 0);
    out.mistakesFixed = Number(row?.fixed ?? 0);
  }

  private async loadBuddySessions(
    userId: string,
    out: TrophyStats,
  ): Promise<void> {
    const rows = await this.sessions
      .createQueryBuilder('s')
      .select('s.mode', 'mode')
      .addSelect('COUNT(*)::int', 'n')
      .where('s.user_id = :userId', { userId })
      .groupBy('s.mode')
      .getRawMany<{ mode: BuddySessionMode; n: number }>();

    let total = 0;
    for (const r of rows) {
      out.buddySessions[r.mode] = Number(r.n);
      total += Number(r.n);
    }
    out.buddySessions.total = total;
  }

  private async loadBuddyDistinct(
    userId: string,
    out: TrophyStats,
  ): Promise<void> {
    const row = await this.sessions
      .createQueryBuilder('s')
      .select('COUNT(DISTINCT s.buddy_slug)::int', 'n')
      .where('s.user_id = :userId', { userId })
      .getRawOne<{ n: number }>();
    out.buddyDistinct = Number(row?.n ?? 0);
  }
}
