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
   * The notification-centre feed for one user: their personal rows plus the
   * broadcasts aimed at them (everyone, or their role). Newest first.
   *
   * The app has always called this endpoint — it just never existed on the
   * server, so the centre showed nothing.
   */
  findForUser(user: User, limit = 50): Promise<Notification[]> {
    return this.notifications
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId: user.id })
      .orWhere(
        'n.user_id IS NULL AND (n.target_role IS NULL OR n.target_role = :role)',
        { role: user.role },
      )
      .orderBy('n.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Send one personal notification to several users: a centre row each, plus a
   * push to whoever has a live token.
   *
   * Delivery is best-effort on purpose. This is called from inside actions like
   * "assign homework" — a dead push token or an Expo outage must never make the
   * assignment itself fail, so everything here is caught and logged.
   */
  async notifyUsers(
    userIds: string[],
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): Promise<{ sent: number }> {
    if (userIds.length === 0) return { sent: 0 };

    try {
      // save(create(...)) rather than insert(): TypeORM's insert type cannot
      // express a free-form jsonb column, and this stays one INSERT anyway.
      await this.notifications.save(
        userIds.map((userId) =>
          this.notifications.create({
            userId,
            title: payload.title,
            body: payload.body,
            data: payload.data ?? null,
            targetRole: null,
          }),
        ),
      );

      const recipients = await this.users.find({
        where: {
          id: In(userIds),
          expoPushToken: Not(IsNull()),
          pushEnabled: true,
        },
        select: { id: true, expoPushToken: true },
      });
      if (recipients.length === 0) return { sent: 0 };

      const { sent, invalidTokens } = await this.push.send(
        recipients.map((u) => ({
          to: u.expoPushToken!,
          title: payload.title,
          body: payload.body,
          data: payload.data ?? {},
        })),
      );
      await this.dropInvalidTokens(invalidTokens);
      return { sent };
    } catch (err) {
      this.logger.error(
        `notifyUsers failed: ${(err as Error)?.message ?? err}`,
      );
      return { sent: 0 };
    }
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
