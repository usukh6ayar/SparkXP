import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from '../entities/message.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiGatewayService } from './ai-gateway.service';
import { AiGatewayController } from './ai-gateway.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Message, AiUsage])],
  providers: [AiGatewayService],
  controllers: [AiGatewayController],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}
