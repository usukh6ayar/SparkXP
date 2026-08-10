import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { SpeakingController } from './speaking.controller';
import { SpeakingService } from './speaking.service';

/**
 * Speaking exercise (pronunciation check). Reuses the AI-gateway STT adapter
 * (exported by AiGatewayModule) — no new provider.
 */
@Module({
  imports: [AiGatewayModule],
  controllers: [SpeakingController],
  providers: [SpeakingService],
})
export class SpeakingModule {}
