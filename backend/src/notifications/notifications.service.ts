import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { User } from '../entities/user.entity';
import { BroadcastNotificationDto } from './dto/broadcast-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async broadcast(dto: BroadcastNotificationDto): Promise<Notification> {
    const where: Record<string, unknown> = {};
    if (dto.targetRole) where.role = dto.targetRole;
    const sentCount = await this.users.count({ where });

    // TODO: send via Expo Push API when expoPushToken is stored on User
    console.log(
      `[Notifications] Broadcasting "${dto.title}" to ${sentCount} users` +
      (dto.targetRole ? ` (role: ${dto.targetRole})` : ''),
    );

    const notification = this.notifications.create({
      title: dto.title,
      body: dto.body,
      targetRole: dto.targetRole ?? null,
      sentCount,
    });
    return this.notifications.save(notification);
  }

  findAll(): Promise<Notification[]> {
    return this.notifications.find({ order: { createdAt: 'DESC' } });
  }
}
