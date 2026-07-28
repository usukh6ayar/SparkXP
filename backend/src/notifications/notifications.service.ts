import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { WordReview } from '../entities/word-review.entity';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';
import { PushService, PushMessage } from './push.service';

/** Users with at least this many words due are worth a reminder. */
const MIN_DUE_WORDS = 5;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(WordReview)
    private readonly reviews: Repository<WordReview>,
    private readonly push: PushService,
  ) {}

  /** Store the device token so this user can receive pushes. */
  async registerToken(userId: string, token: string) {
    await this.users.update(userId, { expoPushToken: token, pushEnabled: true });
    return { ok: true };
  }

  async removeToken(userId: string) {
    await this.users.update(userId, { expoPushToken: null });
    return { ok: true };
  }

  async setPrefs(userId: string, enabled: boolean) {
    await this.users.update(userId, { pushEnabled: enabled });
    return { ok: true, enabled };
  }

  /** Clears tokens Expo told us are dead, so we stop pushing into the void. */
  private async dropInvalidTokens(tokens: string[]) {
    if (tokens.length === 0) return;
    await this.users.update({ expoPushToken: In(tokens) }, { expoPushToken: null });
    this.logger.log(`Cleared ${tokens.length} dead push token(s)`);
  }

  /** Admin broadcast — now actually delivered (was a console.log stub). */
  async broadcast(dto: BroadcastNotificationDto): Promise<Notification> {
    const where: Record<string, unknown> = {
      expoPushToken: Not(IsNull()),
      pushEnabled: true,
    };
    if (dto.targetRole) where.role = dto.targetRole;

    const recipients = await this.users.find({
      where,
      select: { id: true, expoPushToken: true },
    });

    const { sent, invalidTokens } = await this.push.send(
      recipients.map((u) => ({
        to: u.expoPushToken!,
        title: dto.title,
        body: dto.body,
        data: { type: 'broadcast' },
      })),
    );
    await this.dropInvalidTokens(invalidTokens);

    const notification = this.notifications.create({
      title: dto.title,
      body: dto.body,
      targetRole: dto.targetRole ?? null,
      sentCount: sent,
    });
    return this.notifications.save(notification);
  }

  findAll(): Promise<Notification[]> {
    return this.notifications.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * The daily study reminder.
   *
   * Deliberately SPECIFIC rather than a generic "come back!" — it names how
   * many words are actually due, which converts far better. The data already
   * existed (SM-2 `nextReviewAt` on WordReview); only delivery was missing.
   *
   * Skips anyone who already studied today (no nagging active users) and
   * anyone reminded in the last 20h (no double-send if the cron reruns).
   */
  async sendDueReviewReminders(todayKey: string): Promise<{ sent: number }> {
    const dueRows = await this.reviews
      .createQueryBuilder('r')
      .select('r.user_id', 'userId')
      .addSelect('COUNT(*)', 'due')
      .where('r.next_review_at <= NOW()')
      .groupBy('r.user_id')
      .having('COUNT(*) >= :min', { min: MIN_DUE_WORDS })
      .getRawMany<{ userId: string; due: string }>();

    if (dueRows.length === 0) return { sent: 0 };

    const candidates = await this.users.find({
      where: {
        id: In(dueRows.map((r) => r.userId)),
        expoPushToken: Not(IsNull()),
        pushEnabled: true,
      },
      select: {
        id: true,
        expoPushToken: true,
        lastActiveDate: true,
        lastReminderAt: true,
      },
    });

    const cutoff = Date.now() - 20 * 60 * 60 * 1000;
    const dueBy = new Map(dueRows.map((r) => [r.userId, Number(r.due)]));

    const targets = candidates.filter(
      (u) =>
        u.lastActiveDate !== todayKey && // already studied today → leave alone
        (!u.lastReminderAt || u.lastReminderAt.getTime() < cutoff),
    );
    if (targets.length === 0) return { sent: 0 };

    const messages: PushMessage[] = targets.map((u) => ({
      to: u.expoPushToken!,
      title: 'Давтах цаг боллоо 🦊',
      body: `${dueBy.get(u.id) ?? 0} үг чамайг хүлээж байна. 2 минут л хангалттай!`,
      data: { type: 'review_due' },
    }));

    const { sent, invalidTokens } = await this.push.send(messages);
    await this.dropInvalidTokens(invalidTokens);

    await this.users.update(
      { id: In(targets.map((u) => u.id)) },
      { lastReminderAt: new Date() },
    );

    this.logger.log(`Review reminders: ${sent}/${targets.length} delivered`);
    return { sent };
  }
}
