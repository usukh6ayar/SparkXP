import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { DictionaryService } from './dictionary.service';
import { DictionaryController } from './dictionary.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, Word, AiUsage])],
  providers: [DictionaryService],
  controllers: [DictionaryController],
})
export class DictionaryModule {}
