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
} from '@nestjs/common';
import { LessonsService } from './lessons.service';
import { LessonAccessService } from './lesson-access.service';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';
import { UpdateTranscriptDto } from './dto/update-transcript.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';

/**
 * Lesson endpoints under /api/lessons.
 * GET routes are public (mobile app browses without auth).
 * Write routes (POST/PATCH/DELETE) are admin-only.
 */
@Controller('lessons')
export class LessonsController {
  constructor(
    private readonly lessonsService: LessonsService,
    private readonly lessonAccess: LessonAccessService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  create(@Body() dto: CreateLessonDto) {
    return this.lessonsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryLessonsDto) {
    return this.lessonsService.findAll(query);
  }

  /**
   * Student's "Continue learning" target — the next unfinished lesson + real
   * progress through its level (C1). Declared before `:id` so "continue" isn't
   * captured as a lesson id.
   */
  @Get('continue')
  @UseGuards(JwtAuthGuard)
  getContinue(@CurrentUser() user: User) {
    return this.lessonsService.getContinue(user.id);
  }

  /** Lesson ids the student has completed — drives the level trail's
   *  checkmarks. Declared before `:id` so "completed" isn't read as an id. */
  @Get('completed')
  @UseGuards(JwtAuthGuard)
  completed(@CurrentUser() user: User) {
    return this.lessonsService.completedIds(user.id);
  }

  /**
   * Видеог бичвэр болгоно (Gemini STT). Админ-only: энэ нь мөнгө
   * зарцуулдаг дуудлага. 10 минутын видео ≈ 30–60 секунд тул синхрон.
   */
  @Post(':id/transcribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  transcribe(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.transcribe(id, user.id);
  }

  /** Админд бичвэрийг тусад нь өгнө — GET /lessons дээрээс хасагддаг. */
  @Get(':id/transcript')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getTranscript(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.getTranscript(id);
  }

  /** Гараар засварласан бичвэр. PATCH /lessons/:id үүнийг бичиж ЧАДАХГҮЙ. */
  @Patch(':id/transcript')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  saveTranscript(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTranscriptDto,
  ) {
    return this.lessonsService.saveTranscript(id, dto.text);
  }

  /** What this student may do with this lesson (plan / unlock / homework / quota). */
  @Get(':id/access')
  @UseGuards(JwtAuthGuard)
  access(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonAccess.getAccess(user.id, id);
  }

  /**
   * "Эхлэх" — grant access, spending one free right unless this lesson is
   * homework. Idempotent, so a double tap cannot cost two rights.
   */
  @Post(':id/open')
  @UseGuards(JwtAuthGuard)
  open(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonAccess.open(user.id, id);
  }

  /**
   * Public, but the paid `content` only comes back to someone entitled to it —
   * otherwise the paywall would live in the app alone and a plain curl would
   * walk past it. Title, description and thumbnail stay readable to everyone so
   * the locked screen still has something to show.
   */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(
    @CurrentUser() user: User | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const lesson = await this.lessonsService.findOne(id);
    const allowed = await this.lessonAccess.canSeeContent(user?.id ?? null, id);
    return allowed ? lesson : { ...lesson, content: {} };
  }

  /** Student marks a lesson complete → awards XP once (idempotent). */
  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  complete(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.complete(user.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.lessonsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.remove(id);
  }
}
