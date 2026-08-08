import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiBuddy } from '../entities/ai-buddy.entity';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { BuddySession } from '../entities/buddy-session.entity';
import { BuddyMemory } from '../entities/buddy-memory.entity';
import { BuddyVoiceCache } from '../entities/buddy-voice-cache.entity';
import { SafetyEvent } from '../entities/safety-event.entity';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayController } from './ai-gateway.controller';
import { BuddyController } from './buddy.controller';
import { BuddyRealtimeController } from './buddy-realtime.controller';
import { ImageStorageService } from './image-storage.service';
import { aiProviders } from './providers/providers.config';
import { BuddyUsageService } from './buddy-usage.service';
import { BuddyMemoryService } from './buddy-memory.service';
import { BuddyService } from './buddy.service';
import { BuddyRealtimeService } from './buddy-realtime.service';
import { AiBuddyEnabledGuard } from './guards/ai-buddy-enabled.guard';
import { XpModule } from '../xp/xp.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Message,
      AiUsage,
      AiBuddy,
      User,
      Plan,
      BuddySession,
      BuddyMemory,
      BuddyVoiceCache,
      SafetyEvent,
    ]),
    XpModule,
  ],
  providers: [
    AiGatewayService,
    ImageStorageService,
    ...aiProviders,
    BuddyUsageService,
    BuddyMemoryService,
    BuddyService,
    BuddyRealtimeService,
    AiBuddyEnabledGuard,
  ],
  controllers: [AiGatewayController, BuddyController, BuddyRealtimeController],
  exports: [AiGatewayService, ImageStorageService],
})
export class AiGatewayModule {}
