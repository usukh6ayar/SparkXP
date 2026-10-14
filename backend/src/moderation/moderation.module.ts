import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UserBlock } from '../entities/user-block.entity';
import { UserReport } from '../entities/user-report.entity';
import {
  AdminReportsController,
  ModerationController,
} from './moderation.controller';
import { ModerationService } from './moderation.service';

/** Report + block users (App Store guideline 1.2). */
@Module({
  imports: [TypeOrmModule.forFeature([UserReport, UserBlock, User])],
  controllers: [ModerationController, AdminReportsController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
