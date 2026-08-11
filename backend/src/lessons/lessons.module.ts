import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { XpModule } from '../xp/xp.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

/** Lesson CRUD. Exports LessonsService so the Sparks store (lesson unlock)
 *  and other modules can reuse it. Imports XP to reward lesson completion, and
 *  AiGateway for the shared STT adapter (video → transcript). */
@Module({
  imports: [TypeOrmModule.forFeature([Lesson, AiUsage]), XpModule, AiGatewayModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
