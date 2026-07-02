import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiBuddy } from '../entities/ai-buddy.entity';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayController } from './ai-gateway.controller';
import { ImageStorageService } from './image-storage.service';
import { aiProviders } from './providers/providers.config';
import { BuddyUsageService } from './buddy-usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message, AiUsage, AiBuddy, User, Plan])],
  providers: [AiGatewayService, ImageStorageService, ...aiProviders, BuddyUsageService],
  controllers: [AiGatewayController],
  exports: [AiGatewayService, ImageStorageService],
})
export class AiGatewayModule {}
