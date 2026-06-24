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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WordsService } from './words.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QuizQueryDto, QuizSubmitDto } from './dto/quiz.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
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
  /** GET /api/words/stats — review panel summary (counts by status, missing media). */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getStats() {
    return this.wordsService.getStats();
  }

  /**
   * PATCH /api/words/bulk  { ids: string[], changes: { status?, category?, level? } }
   * Bulk-update status / category / level for a set of words (admin review queue).
   */
  @Patch('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkEdit(
    @Body('ids') ids: string[],
    @Body('changes') changes: Record<string, unknown>,
  ) {
    if (!Array.isArray(ids) || ids.length === 0) throw new BadRequestException('"ids" массив шаардлагатай');
    return this.wordsService.bulkEdit(ids, changes as any);
  }

  /**
   * POST /api/words/import  (multipart, field: file, .csv)
   * Import CSV with full validation report. New words → needs_review.
   */
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('CSV файл шаардлагатай (field: file)');
    const text = file.buffer.toString('utf-8');
    return this.wordsService.importCsv(text);
  }

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
  create(@CurrentUser() user: User, @Body() dto: CreateWordDto) {
    return this.wordsService.create(dto, user.id);
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

  /**
   * Generate a vocabulary quiz (multiple-choice) from published words.
   * Declared before `:id` so the literal "quiz" path isn't parsed as a UUID.
   */
  @Get('quiz')
  @UseGuards(JwtAuthGuard)
  getQuiz(@Query() query: QuizQueryDto) {
    return this.wordsService.generateQuiz(query.count);
  }

  /** Submit quiz answers → graded server-side, awards XP + Sparks for correct. */
  @Post('quiz/submit')
  @UseGuards(JwtAuthGuard)
  submitQuiz(@CurrentUser() user: User, @Body() dto: QuizSubmitDto) {
    return this.wordsService.gradeQuiz(user.id, dto.answers);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.wordsService.findOne(id);
  }

  @Post(':id/generate-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateImage(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wordsService.generateImage(id, user.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWordDto,
  ) {
    return this.wordsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.wordsService.remove(id);
  }
}
