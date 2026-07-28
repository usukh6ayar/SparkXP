import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { SchedulerService } from './scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), NotificationsModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
