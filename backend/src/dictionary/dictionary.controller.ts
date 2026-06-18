import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { DictionaryService } from './dictionary.service';

@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(private readonly dictionary: DictionaryService) {}

  /**
   * GET /api/dictionary/:word
   * Returns a Mongolian explanation for the given English word.
   * Checks plan limits → DB cache → Anthropic AI fallback.
   */
  @Get(':word')
  explain(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.explain(user.id, word);
  }
}
