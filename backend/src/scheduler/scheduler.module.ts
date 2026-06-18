import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { SchedulerService } from './scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [SchedulerService],
})
export class SchedulerModule {}
