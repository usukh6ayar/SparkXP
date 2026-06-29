import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadingPassage } from '../entities/reading-passage.entity';
import { ReadingService } from './reading.service';
import { ReadingController } from './reading.controller';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { XpModule } from '../xp/xp.module';

/**
 * Reading passages (Reading feature, M7): CRUD + AI guess-choices (F1) +
 * sentence audio (F4) + XP on completion.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReadingPassage]), AiGatewayModule, XpModule],
  controllers: [ReadingController],
  providers: [ReadingService],
  exports: [ReadingService],
})
export class ReadingModule {}
