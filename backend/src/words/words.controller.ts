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
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WordsService } from './words.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QuizQueryDto, QuizSubmitDto } from './dto/quiz.dto';
import { BulkUpdateDto } from './dto/bulk-update.dto';
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
  private readonly logger = new Logger(WordsController.name);

  constructor(private readonly wordsService: WordsService) {}

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
    return this.wordsService.bulkImport(words);
  }

  /**
   * AI bulk import: a list of bare English words → AI fills every field (+
   * optional image and/or pronunciation audio) per word. POST /api/words/ai-bulk
   *   { words: string[], generateImages?: boolean, generateAudios?: boolean }
   * No size cap: media batches run in the background, text-only stay synchronous.
   */
  @Post('ai-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiBulk(
    @Body('words') words: string[],
    @Body('generateImages') generateImages?: boolean,
    @Body('generateAudios') generateAudios?: boolean,
  ) {
    if (!Array.isArray(words) || words.length === 0) {
      throw new BadRequestException('"words" массив шаардлагатай');
    }
    // Cap the file/bulk English-word import at 1000 per request (Gemini fills the
    // rest). Split bigger lists into batches.
    const maxWords = Number(process.env.AI_BULK_MAX_WORDS ?? 1000);
    if (words.length > maxWords) {
      throw new BadRequestException(
        `Нэг удаад ${maxWords}-аас ихгүй үг (танай файлд ${words.length} байна). Багцлан оруулна уу.`,
      );
    }
    const withMedia = generateImages || generateAudios;

    // Media generation (image/audio) is slow — a synchronous request would
    // exceed the proxy timeout and 502 even though the work keeps running on the
    // server (filling Cloudinary). So run it in the BACKGROUND and return at
    // once; the admin refreshes the list to see words appear. Text-only batches
    // are fast, so those stay synchronous and return the full report.
    if (withMedia) {
      const jobId = this.wordsService.startAiBulk(
        words,
        generateImages ?? false,
        generateAudios ?? false,
      );
      return { started: true, requested: words.length, background: true, jobId };
    }

    return this.wordsService.aiBulkImport(words, false, false);
  }

  /** Poll background AI-bulk / media-bulk progress: GET /api/words/ai-bulk/:jobId */
  @Get('ai-bulk/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiBulkStatus(@Param('jobId') jobId: string) {
    const job = this.wordsService.getBulkJob(jobId);
    if (!job) {
      // Unknown id = finished long ago (and cleaned up) or never existed.
      return { done: true, expired: true };
    }
    return job;
  }

  /**
   * Stop a running background job (admin "Зогсоох" button):
   * POST /api/words/ai-bulk/:jobId/cancel. In-flight items finish; no new ones start.
   */
  @Post('ai-bulk/:jobId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  cancelBulk(@Param('jobId') jobId: string) {
    const canceled = this.wordsService.cancelBulkJob(jobId);
    return { canceled };
  }

  /**
   * Generate image and/or audio for a set of EXISTING words (admin selects them
   * by checkbox). Runs in the background (image calls are rate-limited), returns
   * a jobId — poll GET /words/ai-bulk/:jobId. POST /api/words/bulk-generate-media
   *   { wordIds: string[], image?: boolean, audio?: boolean }
   */
  @Post('bulk-generate-media')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkGenerateMedia(
    @Body('wordIds') wordIds: string[],
    @Body('image') image: boolean | undefined,
    @Body('audio') audio: boolean | undefined,
    @CurrentUser() user: User,
  ) {
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      throw new BadRequestException('"wordIds" массив шаардлагатай');
    }
    if (!image && !audio) {
      throw new BadRequestException('image эсвэл audio-н аль нэгийг сонгоно уу');
    }
    // No cap — runs in the background, batched + cancelable, so any count is fine.
    const jobId = this.wordsService.startBulkMedia(
      wordIds,
      !!image,
      !!audio,
      user.id,
    );
    return { started: true, requested: wordIds.length, background: true, jobId };
  }

  // ── OpenAI Batch images (cheap bulk; async) ────────────────────────────────

  /**
   * Submit selected words for cheap async image generation via OpenAI Batch API
   * (~50% cheaper, up to 50k/job). Returns { batchId } — poll status, then ingest.
   * POST /api/words/image-batch  { wordIds: string[] }
   */
  @Post('image-batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  startImageBatch(@Body('wordIds') wordIds: string[]) {
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      throw new BadRequestException('"wordIds" массив шаардлагатай');
    }
    // OpenAI caps "enqueued tokens" per org (gpt-image-2 = 1,000,000). Our prompt
    // is ~1000 tokens/image, so one job can hold ~800 words before OpenAI rejects
    // it. Cap a single UI submit to a safe size; for big runs use the chunking
    // script (backend/scripts/send-image-batch.mjs). Raise as your org tier grows.
    const maxPerJob = Number(process.env.OPENAI_BATCH_MAX_WORDS ?? 800);
    if (wordIds.length > maxPerJob) {
      throw new BadRequestException(
        `Нэг batch-д ${maxPerJob}-аас ихгүй үг (OpenAI enqueued token хязгаар). ` +
          `${wordIds.length} ширхгийг хэсэгчлэн оруулна уу, эсвэл send-image-batch.mjs скрипт ашигла.`,
      );
    }
    return this.wordsService.startImageBatch(wordIds);
  }

  /** Poll a batch image job: GET /api/words/image-batch/:batchId */
  @Get('image-batch/:batchId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  imageBatchStatus(@Param('batchId') batchId: string) {
    return this.wordsService.getImageBatchStatus(batchId);
  }

  /**
   * Ingest a completed batch: download results + save each image to its word.
   * POST /api/words/image-batch/:batchId/ingest
   */
  @Post('image-batch/:batchId/ingest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  ingestImageBatch(@Param('batchId') batchId: string) {
    return this.wordsService.ingestImageBatch(batchId);
  }

  @Get()
  findAll(@Query() query: QueryWordsDto) {
    return this.wordsService.findAll(query);
  }

  /** Content-health counts (total, by status, missing image/audio, dupes). */
  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getStats() {
    return this.wordsService.getStats();
  }

  /** Learning analytics: most forgotten / saved / known / hardest words. */
  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getAnalytics() {
    return this.wordsService.getAnalytics();
  }

  /** Bulk-edit many words at once (publish/approve/categorize). */
  @Patch('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkUpdate(@Body() dto: BulkUpdateDto) {
    if (!dto.ids?.length) throw new BadRequestException('"ids" массив шаардлагатай');
    return this.wordsService.bulkUpdate(dto.ids, dto.changes);
  }

  /**
   * Delete duplicate words, keeping one per English word (case-insensitive).
   * POST /api/words/dedupe → { deleted, groups, kept }.
   */
  @Post('dedupe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  dedupe() {
    return this.wordsService.deduplicate();
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

  @Post(':id/generate-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateAudio(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.wordsService.generateAudio(id, user.id);
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
