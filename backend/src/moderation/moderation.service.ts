import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserReport, type ReportReason } from '../entities/user-report.entity';
import type { ResolveAction } from './dto/moderation.dto';

/** What the app's «Блоклосон хэрэглэгчид» list shows. */
export interface BlockedUserView {
  userId: string;
  fullName: string;
  username: string | null;
  avatarUrl: string | null;
}

/**
 * Report + block for the user-generated parts of the app (profile photo, name)
 * — App Store guideline 1.2. Reports land in the admin «Гомдол» page; blocks
 * hide the blocked user from the blocker's leaderboards.
 */
@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(UserReport)
    private readonly reports: Repository<UserReport>,
    @InjectRepository(UserBlock) private readonly blocks: Repository<UserBlock>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /** One open report per (reporter, reported) — tapping twice doesn't pile up. */
  async report(
    reporterId: string,
    reportedId: string,
    reason: ReportReason,
  ): Promise<void> {
    await this.assertOther(reporterId, reportedId);
    const open = await this.reports.findOne({
      where: { reporterId, reportedId, status: 'open' },
    });
    if (open) return;
    await this.reports.save(
      this.reports.create({ reporterId, reportedId, reason }),
    );
  }

  async block(blockerId: string, blockedId: string): Promise<void> {
    await this.assertOther(blockerId, blockedId);
    // Idempotent: the unique pair makes a second block a no-op.
    await this.blocks
      .createQueryBuilder()
      .insert()
      .values({ blockerId, blockedId })
      .orIgnore()
      .execute();
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blocks.delete({ blockerId, blockedId });
  }

  async listBlocked(blockerId: string): Promise<BlockedUserView[]> {
    const rows = await this.blocks.find({
      where: { blockerId },
      relations: { blocked: true },
      order: { createdAt: 'DESC' },
    });
    return rows.map(({ blocked: u }) => ({
      userId: u.id,
      fullName: u.fullName,
      username: u.username ?? null,
      avatarUrl: u.avatarUrl ?? null,
    }));
  }

  /** Ids the viewer has blocked — the leaderboard drops these rows. */
  async blockedIds(viewerId: string): Promise<Set<string>> {
    const rows = await this.blocks.find({
      where: { blockerId: viewerId },
      select: { blockedId: true },
    });
    return new Set(rows.map((r) => r.blockedId));
  }

  // --- Admin ---

  /** Open reports first, newest first within each group. */
  listReports() {
    return this.reports.find({
      relations: { reporter: true, reported: true },
      order: { status: 'ASC', createdAt: 'DESC' },
      take: 200,
      select: {
        id: true,
        reason: true,
        status: true,
        action: true,
        createdAt: true,
        resolvedAt: true,
        reporter: { id: true, fullName: true, username: true },
        reported: { id: true, fullName: true, username: true, avatarUrl: true },
      },
    });
  }

  countOpen(): Promise<number> {
    return this.reports.count({ where: { status: 'open' } });
  }

  /**
   * Act on a report. `remove_avatar` / `reset_name` also close every other open
   * report against the same user — the content they complained about is gone.
   */
  async resolve(id: string, action: ResolveAction): Promise<void> {
    const report = await this.reports.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Гомдол олдсонгүй');

    if (action === 'remove_avatar') {
      await this.users.update(report.reportedId, { avatarUrl: null });
    } else if (action === 'reset_name') {
      // Username is a login handle, but phone login still works; the user can
      // pick a new one from their profile.
      await this.users.update(report.reportedId, {
        fullName: 'SparkXP хэрэглэгч',
        username: `user_${randomBytes(3).toString('hex')}`,
      });
    }

    const closeAll = action !== 'dismiss';
    await this.reports.update(
      closeAll ? { reportedId: report.reportedId, status: 'open' } : { id },
      { status: 'resolved', action, resolvedAt: new Date() },
    );
  }

  private async assertOther(meId: string, otherId: string): Promise<void> {
    if (meId === otherId)
      throw new BadRequestException('Өөрийгөө сонгох боломжгүй');
    const exists = await this.users.exist({ where: { id: otherId } });
    if (!exists) throw new NotFoundException('Хэрэглэгч олдсонгүй');
  }
}
