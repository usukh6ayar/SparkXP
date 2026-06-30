import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Idiom } from '../entities/idiom.entity';
import { IdiomsService } from './idioms.service';
import { IdiomsController } from './idioms.controller';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

/** Idioms (Хэлц үг): CRUD + AI fill (Gemini) + pronunciation audio (ElevenLabs). */
@Module({
  imports: [TypeOrmModule.forFeature([Idiom]), AiGatewayModule],
  controllers: [IdiomsController],
  providers: [IdiomsService],
  exports: [IdiomsService],
})
export class IdiomsModule {}
