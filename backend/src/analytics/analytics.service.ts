import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { WordReview } from '../entities/word-review.entity';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { BuddySession } from '../entities/buddy-session.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Message } from '../entities/message.entity';
import { XpService } from '../xp/xp.service';
import { StarsService } from '../xp/stars.service';
import { XpSource, MessageRole } from '../common/enums';
import { startOfUBDay, dayKeyUB } from '../xp/gamification';

/** Words with interval ≥ this many days count as "mastered" (matches
 *  achievements/conditions.ts + teacher progress). */
const MASTERED_INTERVAL_DAYS = 21;
/** > this gap between activities → a new study session. */
const SESSION_GAP_MS = 30 * 60_000;
/** A session with any activity is worth at least this many minutes. */
const MIN_SESSION_MIN = 2;
const DAY_MS = 86_400_000;

interface StudySession {
  start: number;
  minutes: number;
}

/** Group activity timestamps into study sessions (gap-split), each with minutes. */
function sessionize(timestamps: number[]): StudySession[] {
  if (!timestamps.length) return [];
  const sorted = [...timestamps].sort((a, b) => a - b);
  const out: StudySession[] = [];
  let start = sorted[0];
  let last = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - last > SESSION_GAP_MS) {
      out.push({
        start,
        minutes: Math.max(MIN_SESSION_MIN, Math.round((last - start) / 60_000)),
      });
      start = sorted[i];
    }
    last = sorted[i];
  }
  out.push({
    start,
    minutes: Math.max(MIN_SESSION_MIN, Math.round((last - start) / 60_000)),
  });
  return out;
}

/**
 * Learning analytics — a READ-ONLY aggregation over the data the app already
 * writes (xp_logs, sparks_logs, word_reviews, quiz_attempts, buddy_sessions,
 * ai_usages, messages). No new tables, no new tracking: study time is derived
 * by sessionising the existing activity timestamps. Reuses `XpService`
 * (streak/xp) and `StarsService` (stars).
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(XpLog) private readonly xpLogs: Repository<XpLog>,
    @InjectRepository(SparksLog)
    private readonly sparksLogs: Repository<SparksLog>,
    @InjectRepository(WordReview)
    private readonly words: Repository<WordReview>,
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(BuddySession)
    private readonly sessions: Repository<BuddySession>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    private readonly xp: XpService,
    private readonly stars: StarsService,
  ) {}

  /** All of a user's XP-log rows, trimmed to what analytics needs. */
  private async xpActivity(
    userId: string,
  ): Promise<
    { at: number; amount: number; source: string; refId: string | null }[]
  > {
    const rows = await this.xpLogs
      .createQueryBuilder('x')
      .select('x.created_at', 'createdAt')
      .addSelect('x.amount', 'amount')
      .addSelect('x.source', 'source')
      .addSelect('x.reference_id', 'refId')
      .where('x.user_id = :userId', { userId })
      .getRawMany<{
        createdAt: Date;
        amount: string;
        source: string;
        refId: string | null;
      }>();
    return rows.map((r) => ({
      at: new Date(r.createdAt).getTime(),
      amount: Number(r.amount),
      source: r.source,
      refId: r.refId,
    }));
  }

  /** The full learner snapshot for the profile + future dashboards. */
  async overview(userId: string) {
    const now = Date.now();
    const startToday = startOfUBDay().getTime();
    const startWeek = now - 7 * DAY_MS;
    const startMonth = now - 30 * DAY_MS;

    const [
      activity,
      gam,
      starsEarned,
      sparksRow,
      wordsLearned,
      wordsMastered,
      reviewedRow,
      practiceSessions,
      practiceCompleted,
      buddyRow,
      voiceRow,
      textMessages,
    ] = await Promise.all([
      this.xpActivity(userId),
      this.xp.getGamification(userId),
      this.stars.totalStars(userId),
      this.sparksLogs
        .createQueryBuilder('s')
        .select('COALESCE(SUM(s.amount), 0)', 'sum')
        .where('s.user_id = :userId', { userId })
        .andWhere('s.amount > 0')
        .getRawOne<{ sum: string }>(),
      this.words.count({ where: { userId } }),
      this.words.count({
        where: {
          userId,
          intervalDays: MoreThanOrEqual(MASTERED_INTERVAL_DAYS),
        },
      }),
      this.words
        .createQueryBuilder('w')
        .select('COALESCE(SUM(w.repetitions), 0)', 'sum')
        .where('w.user_id = :userId', { userId })
        .getRawOne<{ sum: string }>(),
      this.attempts.count({ where: { userId } }),
      this.attempts.count({ where: { userId, scorePct: MoreThanOrEqual(50) } }),
      this.sessions
        .createQueryBuilder('bs')
        .select('COUNT(*)', 'sessions')
        .addSelect(
          'COALESCE(SUM(EXTRACT(EPOCH FROM (bs.ended_at - bs.created_at))), 0)',
          'seconds',
        )
        .where('bs.user_id = :userId', { userId })
        .andWhere('bs.ended_at IS NOT NULL')
        .getRawOne<{ sessions: string; seconds: string }>(),
      this.aiUsages
        .createQueryBuilder('a')
        .select('COALESCE(SUM(a.voice_seconds), 0)', 'seconds')
        .where('a.user_id = :userId', { userId })
        .getRawOne<{ seconds: string }>(),
      this.messages.count({ where: { userId, role: MessageRole.USER } }),
    ]);

    // Study time from sessionised activity timestamps.
    const studySessions = sessionize(activity.map((a) => a.at));
    const studyMinutes = (from: number) =>
      studySessions
        .filter((s) => s.start >= from)
        .reduce((sum, s) => sum + s.minutes, 0);

    // Lessons completed = distinct lessons that logged LESSON xp.
    const lessonRefs = new Set(
      activity
        .filter((a) => a.source === XpSource.LESSON && a.refId)
        .map((a) => a.refId),
    );
    const lessonsCompleted = lessonRefs.size;
    const lessonsTotal = Object.values(gam.progressByLevel).reduce(
      (s, p) => s + p.total,
      0,
    );

    return {
      study: {
        totalMinutes: studyMinutes(0),
        todayMinutes: studyMinutes(startToday),
        weekMinutes: studyMinutes(startWeek),
        monthMinutes: studyMinutes(startMonth),
      },
      lessons: {
        completed: lessonsCompleted,
        total: lessonsTotal,
        completionRate:
          lessonsTotal > 0
            ? Math.round((lessonsCompleted / lessonsTotal) * 100)
            : 0,
      },
      practice: {
        sessions: practiceSessions,
        completed: practiceCompleted,
      },
      vocabulary: {
        learned: wordsLearned,
        reviewed: Number(reviewedRow?.sum ?? 0),
        mastered: wordsMastered,
      },
      buddy: {
        sessions: Number(buddyRow?.sessions ?? 0),
        minutes: Math.round(Number(buddyRow?.seconds ?? 0) / 60),
        voiceMinutes: Math.round(Number(voiceRow?.seconds ?? 0) / 60),
        textMessages,
      },
      gamification: {
        xp: gam.xp,
        sparksEarned: Number(sparksRow?.sum ?? 0),
        stars: starsEarned,
        currentStreak: gam.currentStreak,
        longestStreak: gam.longestStreak,
      },
    };
  }

  /**
   * Per-day series for the activity chart. `range` = week (7d) or month (30d).
   * Each day: XP earned + study minutes. Zero-filled so the chart has no gaps.
   */
  async history(userId: string, range: 'week' | 'month') {
    const days = range === 'month' ? 30 : 7;
    const now = Date.now();
    // Fetch a full extra day of slack so early-morning activity of the oldest
    // UB day (which starts up to 8h before the UTC instant) isn't dropped.
    const from = now - days * DAY_MS;

    const activity = (await this.xpActivity(userId)).filter(
      (a) => a.at >= from,
    );
    const studySessions = sessionize(activity.map((a) => a.at));

    // Seed every UB day in range to 0 (oldest → newest), then fill. Keys are UB
    // day boundaries so the chart lines up with streaks + overview.todayMinutes.
    const buckets = new Map<string, { xp: number; studyMinutes: number }>();
    for (let i = days - 1; i >= 0; i--) {
      buckets.set(dayKeyUB(new Date(now - i * DAY_MS)), {
        xp: 0,
        studyMinutes: 0,
      });
    }
    for (const a of activity) {
      const b = buckets.get(dayKeyUB(new Date(a.at)));
      if (b) b.xp += a.amount;
    }
    for (const s of studySessions) {
      const b = buckets.get(dayKeyUB(new Date(s.start)));
      if (b) b.studyMinutes += s.minutes;
    }

    return {
      range,
      days: [...buckets.entries()].map(([date, v]) => ({
        date,
        xp: v.xp,
        studyMinutes: v.studyMinutes,
      })),
    };
  }
}
