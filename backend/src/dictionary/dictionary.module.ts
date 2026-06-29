import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { DictionaryService } from './dictionary.service';
import { DictionaryController } from './dictionary.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Word, AiUsage, Translation]),
    AiGatewayModule,
  ],
  providers: [DictionaryService],
  controllers: [DictionaryController],
})
export class DictionaryModule {}
