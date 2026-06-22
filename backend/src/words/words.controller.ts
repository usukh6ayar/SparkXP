import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { WordsService } from './words.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../common/enums';

/**
 * Vocabulary endpoints under /api/words.
 *
 * - Reads (GET) are open to any logged-in user (students browse vocabulary).
 * - Writes (POST/PATCH/DELETE) are admin-only — content is authored from the
 *   admin panel, never by students.
 */
@Controller('words')
export class WordsController {
  constructor(private readonly wordsService: WordsService) {}

  /**
   * POST /api/words/ai-fill  { english: "abandon" }
   * Admin helper — returns AI-generated mongolian, partOfSpeech,
   * exampleSentence, exampleTranslation so the form can be pre-filled.
   */
  @Post('ai-fill')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiFill(@Body('english') english: string) {
    if (!english?.trim()) throw new BadRequestException('english оруулна уу');
    return this.wordsService.aiFill(english.trim());
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateWordDto) {
    return this.wordsService.create(dto);
  }

  /**
   * Bulk import words from a JSON array.
   * POST /api/words/bulk  { words: [...] }
   * Returns { inserted, skipped } counts.
   */
  @Post('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkImport(@Body('words') words: CreateWordDto[]) {
    if (!Array.isArray(words) || words.length === 0) {
      throw new BadRequestException('"words" массив шаардлагатай');
    }
    if (words.length > 50_000) {
      throw new BadRequestException('Нэг удаад 50,000-аас дээш үг оруулах боломжгүй');
    }
    return this.wordsService.bulkImport(words);
  }

  @Get()
  findAll(@Query() query: QueryWordsDto) {
    return this.wordsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.wordsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWordDto,
  ) {
    return this.wordsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.wordsService.remove(id);
  }
}
