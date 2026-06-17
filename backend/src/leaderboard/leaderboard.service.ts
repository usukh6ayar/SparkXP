import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { ClassEntity } from '../entities/class.entity';
import { LeaderboardScope, UserRole } from '../common/enums';
import { QueryLeaderboardDto } from './dto/query-leaderboard.dto';
import { periodStart } from './period';

/** One row in the ranked list. */
export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
  province: string | null;
  district: string | null;
  xp: number;
}

/** The current user's standing (null xp if they earned nothing in the window). */
export interface MyStanding {
  rank: number | null;
  xp: number;
}

export interface LeaderboardResult {
  period: string;
  scope: string;
  entries: LeaderboardEntry[];
  me: MyStanding;
}

/**
 * Computes leaderboards from the XpLog ledger.
 *
 * Ranked by XP (never Sparks). "Periods" are just date windows over
 * XpLog.created_at — XP is never reset. MVP uses Postgres aggregation; swap to
 * Redis sorted sets later if scale needs it.
 */
@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(XpLog)
    private readonly xpLogs: Repository<XpLog>,
    @InjectRepository(ClassEntity)
    private readonly classes: Repository<ClassEntity>,
  ) {}

  async getLeaderboard(
    user: User,
    query: QueryLeaderboardDto,
  ): Promise<LeaderboardResult> {
    const since = periodStart(query.period);

    // Resolve which concrete scope value to filter by (the user's own province,
    // district, org, a given class, or the teacher that owns their class).
    // Returns null if the scope can't be satisfied → empty leaderboard.
    const scopeValue =
      query.scope === LeaderboardScope.TEACHER
        ? await this.resolveTeacherId(user)
        : this.resolveScopeValue(user, query);
    if (scopeValue === null && query.scope !== LeaderboardScope.GLOBAL) {
      return {
        period: query.period,
        scope: query.scope,
        entries: [],
        me: { rank: null, xp: 0 },
      };
    }

    // --- Top N list ---
    const rows = await this.baseQuery(query.scope, scopeValue, since)
      .select('u.id', 'userId')
      .addSelect('u.fullName', 'fullName')
      .addSelect('u.username', 'username')
      .addSelect('u.avatarUrl', 'avatarUrl')
      .addSelect('u.province', 'province')
      .addSelect('u.district', 'district')
      .addSelect('SUM(x.amount)', 'xp')
      .groupBy('u.id')
      .orderBy('xp', 'DESC')
      .limit(query.limit)
      .getRawMany();

    const entries: LeaderboardEntry[] = rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      fullName: r.fullName,
      username: r.username ?? null,
      avatarUrl: r.avatarUrl ?? null,
      province: r.province,
      district: r.district,
      xp: Number(r.xp),
    }));

    // --- Current user's standing ---
    const me = await this.myStanding(user, query.scope, scopeValue, since);

    return { period: query.period, scope: query.scope, entries, me };
  }

  /**
   * Build the base query (XpLog joined to User) with the period + scope filters
   * applied. The caller adds select/group/order.
   */
  private baseQuery(
    scope: LeaderboardScope,
    scopeValue: string | null,
    since: Date | null,
  ): SelectQueryBuilder<XpLog> {
    const qb = this.xpLogs.createQueryBuilder('x').innerJoin('x.user', 'u');

    if (since) {
      qb.andWhere('x.createdAt >= :since', { since });
    }

    switch (scope) {
      case LeaderboardScope.PROVINCE:
        qb.andWhere('u.province = :v', { v: scopeValue });
        break;
      case LeaderboardScope.DISTRICT:
        qb.andWhere('u.district = :v', { v: scopeValue });
        break;
      case LeaderboardScope.ORGANIZATION:
        qb.andWhere('u.organizationId = :v', { v: scopeValue });
        break;
      case LeaderboardScope.CLASS:
        // Join the class_students junction table to keep only class members.
        qb.innerJoin(
          'class_students',
          'cs',
          'cs.student_id = u.id AND cs.class_id = :v',
          { v: scopeValue },
        );
        break;
      case LeaderboardScope.TEACHER:
        // Students enrolled in any class owned by this teacher. Subquery (not a
        // join) so a student in two of the teacher's classes isn't counted twice.
        qb.andWhere(
          `u.id IN (
            SELECT cs.student_id FROM class_students cs
            INNER JOIN classes c ON c.id = cs.class_id
            WHERE c.teacher_id = :v
          )`,
          { v: scopeValue },
        );
        break;
      case LeaderboardScope.GLOBAL:
      default:
        break; // no extra filter
    }

    return qb;
  }

  /** Figure out the value to filter the scope by, or throw/return null. */
  private resolveScopeValue(
    user: User,
    query: QueryLeaderboardDto,
  ): string | null {
    switch (query.scope) {
      case LeaderboardScope.PROVINCE:
        return user.province;
      case LeaderboardScope.DISTRICT:
        return user.district;
      case LeaderboardScope.ORGANIZATION:
        return user.organizationId;
      case LeaderboardScope.CLASS:
        if (!query.classId) {
          throw new BadRequestException('class scope-д classId шаардлагатай');
        }
        return query.classId;
      case LeaderboardScope.GLOBAL:
      default:
        return null; // global needs no value
    }
  }

  /**
   * The teacher id whose student group to rank. A teacher sees their own
   * students (their id); a student sees their teacher's students (the teacher
   * of their most recently joined class). Null → empty leaderboard.
   */
  private async resolveTeacherId(user: User): Promise<string | null> {
    if (user.role === UserRole.TEACHER) return user.id;

    const klass = await this.classes
      .createQueryBuilder('c')
      .innerJoin('c.students', 's', 's.id = :uid', { uid: user.id })
      .where('c.teacher_id IS NOT NULL')
      .orderBy('c.created_at', 'DESC')
      .getOne();
    return klass?.teacherId ?? null;
  }

  /**
   * Admin view: top N users for any scope without relying on the caller's
   * own province/district. `scopeValue` is the explicit filter value
   * (province name, district name, orgId) or null for global.
   */
  async getTopList(
    scope: LeaderboardScope,
    period: string,
    scopeValue: string | null,
    limit = 50,
  ): Promise<LeaderboardEntry[]> {
    const since = periodStart(period as any);
    const rows = await this.baseQuery(scope, scopeValue, since)
      .select('u.id', 'userId')
      .addSelect('u.fullName', 'fullName')
      .addSelect('u.username', 'username')
      .addSelect('u.avatarUrl', 'avatarUrl')
      .addSelect('u.province', 'province')
      .addSelect('u.district', 'district')
      .addSelect('SUM(x.amount)', 'xp')
      .groupBy('u.id')
      .orderBy('xp', 'DESC')
      .limit(limit)
      .getRawMany();

    return rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      fullName: r.fullName,
      username: r.username ?? null,
      avatarUrl: r.avatarUrl ?? null,
      province: r.province,
      district: r.district,
      xp: Number(r.xp),
    }));
  }

  /** The user's XP in this window + their rank (count of users above them + 1). */
  private async myStanding(
    user: User,
    scope: LeaderboardScope,
    scopeValue: string | null,
    since: Date | null,
  ): Promise<MyStanding> {
    // My XP sum in the window/scope.
    const mineRow = await this.baseQuery(scope, scopeValue, since)
      .andWhere('u.id = :me', { me: user.id })
      .select('SUM(x.amount)', 'xp')
      .getRawOne<{ xp: string | null }>();

    const myXp = Number(mineRow?.xp ?? 0);
    if (myXp === 0) {
      // No XP in this window → unranked.
      return { rank: null, xp: 0 };
    }

    // Count distinct users whose XP sum is strictly greater than mine.
    const higher = await this.baseQuery(scope, scopeValue, since)
      .select('u.id')
      .groupBy('u.id')
      .having('SUM(x.amount) > :myXp', { myXp })
      .getRawMany();

    return { rank: higher.length + 1, xp: myXp };
  }
}
