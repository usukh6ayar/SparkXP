import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /** Reset all per-period usage counters on the 1st of each month at midnight UB time. */
  @Cron('0 0 1 * *', { timeZone: 'Asia/Ulaanbaatar' })
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
