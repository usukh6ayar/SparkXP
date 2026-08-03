import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { WordReview } from '../entities/word-review.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { DictionaryEntry } from '../entities/dictionary-entry.entity';
import { UserDictionarySave } from '../entities/user-dictionary-save.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { DictionaryService } from './dictionary.service';
import { DictionarySensesService } from './dictionary-senses.service';
import { DictionaryController } from './dictionary.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Word,
      WordReview,
      AiUsage,
      Translation,
      DictionaryEntry,
      UserDictionarySave,
    ]),
    AiGatewayModule,
  ],
  providers: [DictionaryService, DictionarySensesService],
  controllers: [DictionaryController],
})
export class DictionaryModule {}
