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
  ParseIntPipe,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';
import { QueryReadingDto } from './dto/query-reading.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * Reading passage endpoints under /api/reading (Reading feature, M7).
 *
 * - Reads (GET) are open to any logged-in user; students get published passages
 *   only (the service gates on isPublished unless `all=true` is passed).
 * - Content writes + AI generation are content-team only (admin/moderator).
 * - `POST /:id/complete` is student-facing (awards XP once).
 */
@Controller('reading')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QueryReadingDto) {
    return this.readingService.findAll(query);
  }

  /** Poll a sentence-audio job. Declared before `:id` so it isn't a UUID. */
  @Get('audio-job/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  audioJob(@Param('jobId') jobId: string) {
    return this.readingService.getAudioJob(jobId) ?? { done: true, expired: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.readingService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateReadingDto) {
    return this.readingService.create(dto);
  }

  /**
   * AI-generate "guess the meaning" choices for words (F1, admin review).
   * Declared before `:id`-prefixed POSTs. Body: { words: string[], cefr?: string }.
   */
  @Post('guess-choices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  guessChoices(@Body('words') words: string[], @Body('cefr') cefr?: string) {
    if (!Array.isArray(words) || words.length === 0) {
      throw new BadRequestException('"words" массив шаардлагатай');
    }
    return this.readingService.generateGuessChoices(words, cefr);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReadingDto) {
    return this.readingService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.readingService.remove(id);
  }

  /** Student finished reading → award XP once (idempotent). */
  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  complete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.readingService.complete(user.id, id);
  }

  /** Generate audio for every sentence (background); poll GET /audio-job/:jobId. */
  @Post(':id/generate-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateAudio(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    const jobId = this.readingService.startAudioJob(id, user.id);
    return { started: true, background: true, jobId };
  }

  /** Regenerate audio for one sentence (synchronous). */
  @Post(':id/sentences/:index/generate-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  sentenceAudio(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.readingService.generateSentenceAudio(id, index, user.id);
  }
}
