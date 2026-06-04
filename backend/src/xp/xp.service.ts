import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { XpSource } from '../common/enums';

export interface AwardXpOptions {
  userId: string;
  amount: number;
  source: XpSource;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class XpService {
  constructor(
    @InjectRepository(XpLog)
    private readonly xpLogs: Repository<XpLog>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Award XP atomically: write an XpLog row and increment User.xp in one transaction.
   * Anti-abuse: amount must be > 0 (caller is responsible for correct-answer check).
   */
  async award(opts: AwardXpOptions): Promise<XpLog> {
    if (opts.amount <= 0) return null as unknown as XpLog;

    return this.dataSource.transaction(async (manager) => {
      const log = manager.create(XpLog, {
        userId: opts.userId,
        amount: opts.amount,
        source: opts.source,
        referenceId: opts.referenceId ?? null,
        metadata: opts.metadata ?? null,
      });
      await manager.save(log);

      // Increment the denormalized cache on User — safe inside the transaction.
      await manager.increment(User, { id: opts.userId }, 'xp', opts.amount);

      return log;
    });
  }
}
