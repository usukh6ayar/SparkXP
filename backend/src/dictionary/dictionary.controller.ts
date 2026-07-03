import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { DictionaryService } from './dictionary.service';
import { TranslateSentenceDto } from './dto/translate-sentence.dto';

@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(private readonly dictionary: DictionaryService) {}

  /**
   * GET /api/dictionary/:word
   * Short Mongolian meaning for an English word.
   * Word DB → translation cache → Gemini (plan-limited, result cached).
   */
  @Get(':word')
  explain(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.explain(user.id, word);
  }

  /**
   * POST /api/dictionary/translate
   * Full Mongolian translation of an English sentence/phrase (reading reader:
   * long-press a sentence). Cache → Gemini (sentence prompt), plan-limited.
   */
  @Post('translate')
  translate(@Body() dto: TranslateSentenceDto, @CurrentUser() user: User) {
    return this.dictionary.translateSentence(user.id, dto.text);
  }

  /**
   * GET /api/dictionary/:word/audio
   * Pronunciation audio URL (ElevenLabs). Generated once on the first speaker
   * tap, then cached and reused forever.
   */
  @Get(':word/audio')
  audio(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.getAudio(user.id, word);
  }

  /**
   * POST /api/dictionary/:word/save
   * Save the word (+ its translation) to the user's saved vocabulary.
   */
  @Post(':word/save')
  save(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.saveWord(user.id, word);
  }
}
