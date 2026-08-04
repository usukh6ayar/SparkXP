import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';
import { DictionaryService } from './dictionary.service';
import { DictionarySensesService } from './dictionary-senses.service';
import { TranslateSentenceDto } from './dto/translate-sentence.dto';
import { UpdateSensesDto } from './dto/update-senses.dto';
import { QueryDictionaryDto } from './dto/query-dictionary.dto';

/**
 * /api/dictionary — two related features in one controller:
 *
 *  - Толь search (`/search`, `/saves`, `/admin/*`): the 4-sense result the
 *    search icon opens, cached in `dictionary_entries`.
 *  - Reader helpers (`/:word`, `/translate`, `/:word/audio`): the short gloss,
 *    whole-sentence translation and pronunciation audio. Unchanged.
 *
 * ⚠️ ROUTE ORDER MATTERS. `@Get(':word')` matches any single-segment GET, so
 * every literal path (`/saves`) must be declared ABOVE it or Nest will route
 * `/dictionary/saves` into the word lookup.
 */
@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(
    private readonly dictionary: DictionaryService,
    private readonly senses: DictionarySensesService,
  ) {}

  // ── Толь: admin (declare before the :word routes) ────────────────────────

  /** GET /api/dictionary/admin/entries — paginated Толь listing. */
  @Get('admin/entries')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  adminList(@Query() query: QueryDictionaryDto) {
    return this.senses.adminList(query);
  }

  /** PATCH /api/dictionary/admin/entries/:id — hand-edit the senses. */
  @Patch('admin/entries/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSensesDto,
  ) {
    return this.senses.adminUpdate(id, dto.senses);
  }

  /** DELETE /api/dictionary/admin/entries/:id — the next search regenerates it. */
  @Delete('admin/entries/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  adminRemove(@Param('id', ParseUUIDPipe) id: string) {
    return this.senses.adminRemove(id);
  }

  // ── Толь: student ────────────────────────────────────────────────────────

  /** GET /api/dictionary/saves — the user's ⭐ dictionary words. */
  @Get('saves')
  listSaves(@CurrentUser() user: User) {
    return this.senses.listSaves(user.id);
  }

  /** POST /api/dictionary/saves/:word — toggle ⭐ for a word. */
  @Post('saves/:word')
  toggleSave(@Param('word') word: string, @CurrentUser() user: User) {
    return this.senses.toggleSave(user.id, word);
  }

  /**
   * GET /api/dictionary/search/:word
   * Up to 4 frequency-ordered senses. Cache → Gemini (plan-limited, cached).
   */
  @Get('search/:word')
  search(@Param('word') word: string, @CurrentUser() user: User) {
    return this.senses.search(user.id, word);
  }

  // ── Reader helpers (unchanged behaviour) ─────────────────────────────────

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
   * GET /api/dictionary/:word
   * Short Mongolian meaning for an English word (reader double-tap).
   * Word DB → translation cache → Gemini (plan-limited, result cached).
   */
  @Get(':word')
  explain(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.explain(user.id, word);
  }
}
