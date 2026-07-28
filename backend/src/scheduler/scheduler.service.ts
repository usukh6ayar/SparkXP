import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { dayKeyUB } from '../xp/gamification';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Evening study reminder — 20:00 UB time, when learners are home but not yet
   * asleep. The message names how many words are actually due (the SM-2 data
   * already exists on WordReview); a specific nudge converts far better than a
   * generic "come back".
   *
   * Anyone who already studied today is skipped, so this never nags an active
   * user. Errors are swallowed: a failed reminder must not kill the scheduler.
   */
  @Cron('0 20 * * *', { name: 'daily-review-reminder', timeZone: 'Asia/Ulaanbaatar' })
  async sendDailyReminders() {
    try {
      const { sent } = await this.notifications.sendDueReviewReminders(dayKeyUB());
      this.logger.log(`Daily review reminder — ${sent} push(es) delivered`);
    } catch (err) {
      this.logger.error(`Daily review reminder failed: ${(err as Error).message}`);
    }
  }

  /** Reset all per-period usage counters on the 1st of each month at midnight UB time. */
  @Cron('0 0 1 * *', { name: 'monthly-usage-reset', timeZone: 'Asia/Ulaanbaatar' })
  async resetMonthlyUsage() {
    this.logger.log('Monthly usage reset — starting...');
    const result = await this.users
      .createQueryBuilder()
      .update(User)
      .set({
        voiceSecondsUsed: 0,
        sttSecondsUsed: 0,
        dictionaryAiCount: 0,
        aiInputTokens: 0,
        aiOutputTokens: 0,
        memoryStorageMb: 0,
        usageResetAt: new Date(),
      })
      .execute();
    this.logger.log(`Monthly usage reset complete — ${result.affected ?? 0} users reset`);
  }
}
