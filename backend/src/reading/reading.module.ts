import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReadingPassage } from '../entities/reading-passage.entity';
import { ReadingService } from './reading.service';
import { ReadingController } from './reading.controller';

/**
 * Reading passages (Reading feature, M7). CRUD only for Phase 1; Phase 2 (AI
 * guess-choices) and Phase 3 (sentence audio) will add AiGatewayModule here.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ReadingPassage])],
  controllers: [ReadingController],
  providers: [ReadingService],
  exports: [ReadingService],
})
export class ReadingModule {}
