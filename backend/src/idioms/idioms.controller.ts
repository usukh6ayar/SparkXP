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
import { IdiomsService } from './idioms.service';
import { CreateIdiomDto } from './dto/create-idiom.dto';
import { UpdateIdiomDto } from './dto/update-idiom.dto';
import { QueryIdiomDto } from './dto/query-idiom.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * Idiom endpoints under /api/idioms.
 * - Reads (GET) open to any logged-in user; students get published only.
 * - Writes + AI are content-team only (admin/moderator).
 */
@Controller('idioms')
export class IdiomsController {
  constructor(private readonly idiomsService: IdiomsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: QueryIdiomDto) {
    return this.idiomsService.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateIdiomDto) {
    return this.idiomsService.create(dto);
  }

  /** AI-fill an idiom's fields from its phrase. Before `:id`. */
  @Post('ai-fill')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiFill(@Body('phrase') phrase: string) {
    if (!phrase?.trim()) throw new BadRequestException('phrase оруулна уу');
    return this.idiomsService.aiFill(phrase.trim());
  }

  /**
   * AI bulk import: a list of English idioms → AI fills every field (+ optional
   * image/audio) per idiom. Always runs in the BACKGROUND (Gemini is slow for
   * many phrases) and returns a jobId — poll GET /idioms/ai-bulk/:jobId.
   * POST /api/idioms/ai-bulk  { phrases: string[], generateImages?, generateAudios? }
   * Before `:id`.
   */
  @Post('ai-bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiBulk(
    @CurrentUser() user: User,
    @Body('phrases') phrases: string[],
    @Body('generateImages') generateImages?: boolean,
    @Body('generateAudios') generateAudios?: boolean,
  ) {
    if (!Array.isArray(phrases) || phrases.length === 0) {
      throw new BadRequestException('"phrases" массив шаардлагатай');
    }
    const maxPhrases = Number(process.env.AI_BULK_MAX_WORDS ?? 1000);
    if (phrases.length > maxPhrases) {
      throw new BadRequestException(
        `Нэг удаад ${maxPhrases}-аас ихгүй хэлц (танай файлд ${phrases.length} байна). Багцлан оруулна уу.`,
      );
    }
    const jobId = this.idiomsService.startAiBulk(
      phrases,
      generateImages ?? false,
      generateAudios ?? false,
      user.id,
    );
    return { started: true, requested: phrases.length, background: true, jobId };
  }

  /** Poll a background AI-bulk job: GET /api/idioms/ai-bulk/:jobId. Before `:id`. */
  @Get('ai-bulk/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  aiBulkStatus(@Param('jobId') jobId: string) {
    return this.idiomsService.getBulkJob(jobId) ?? { done: true, expired: true };
  }

  /** Stop a running AI-bulk job ("Зогсоох"). POST /api/idioms/ai-bulk/:jobId/cancel. */
  @Post('ai-bulk/:jobId/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  cancelBulk(@Param('jobId') jobId: string) {
    return { canceled: this.idiomsService.cancelBulkJob(jobId) };
  }

  /**
   * CSV import (multipart, field: file). Required columns: phrase, mongolian.
   * Returns a validation report. New idioms → draft. Before `:id`.
   * POST /api/idioms/import
   */
  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async importCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('CSV файл шаардлагатай (field: file)');
    return this.idiomsService.importCsv(file.buffer.toString('utf-8'));
  }

  /** Bulk-edit selected idioms (e.g. publish). Before `:id`. */
  @Patch('bulk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkUpdate(@Body('ids') ids: string[], @Body('isPublished') isPublished?: boolean) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('"ids" массив шаардлагатай');
    }
    return this.idiomsService.bulkUpdate(ids, { isPublished });
  }

  /** Generate images (OpenAI) for selected idioms in the background → { jobId }. */
  @Post('bulk-generate-images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  bulkGenerateImages(@CurrentUser() user: User, @Body('ids') ids: string[]) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('"ids" массив шаардлагатай');
    }
    const jobId = this.idiomsService.startBulkImages(ids, user.id);
    return { started: true, background: true, requested: ids.length, jobId };
  }

  /** Poll a bulk-image job. Before `:id`. */
  @Get('image-job/:jobId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  imageJob(@Param('jobId') jobId: string) {
    return this.idiomsService.getImageJob(jobId) ?? { done: true, expired: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateIdiomDto) {
    return this.idiomsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.remove(id);
  }

  /** Generate pronunciation audio (ElevenLabs) for an idiom. */
  @Post(':id/generate-audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateAudio(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.generateAudio(id, user.id);
  }

  /** Generate an illustrative image (OpenAI) for one idiom. */
  @Post(':id/generate-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  generateImage(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.idiomsService.generateImage(id, user.id);
  }
}
