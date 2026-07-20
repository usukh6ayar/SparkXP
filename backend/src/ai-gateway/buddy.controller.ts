import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { BuddyService } from './buddy.service';
import {
  StartSessionDto,
  ResumeTextSessionDto,
  TextTurnDto,
  TestVoiceDto,
  FeedbackDto,
} from './dto/buddy-turn.dto';

/** Max uploaded voice clip size (~60s of compressed mono audio). */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

@Controller('ai/buddy')
@UseGuards(JwtAuthGuard)
export class BuddyController {
  constructor(private readonly buddy: BuddyService) {}

  /** Start a new AI Buddy conversation session. */
  @Post('sessions')
  startSession(@Body() dto: StartSessionDto, @CurrentUser() user: User) {
    return this.buddy.startSession(user.id, dto);
  }

  /** Voice turn: upload audio → transcript + reply + audio + avatar instruction. */
  @Post('sessions/:id/turn/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  audioTurn(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('Аудио файл дутуу байна');
    return this.buddy.audioTurn(user.id, sessionId, file);
  }

  /** Text turn: same pipeline, STT skipped. */
  @Post('sessions/:id/turn/text')
  textTurn(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: TextTurnDto,
    @CurrentUser() user: User,
  ) {
    return this.buddy.textTurn(user.id, sessionId, dto.text);
  }

  /** Conversation history for the UI. */
  @Get('sessions/:id/messages')
  getMessages(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.buddy.getMessages(user.id, sessionId);
  }

  /**
   * Open a TEXT chat thread for a buddy and return its message history —
   * ChatGPT-style. Body picks which thread: `sessionId` (a specific past
   * thread), `new: true` (a fresh "New chat"), or default (most recent).
   * Voice sessions stay separate.
   */
  @Post('text-session')
  resumeTextSession(@Body() dto: ResumeTextSessionDto, @CurrentUser() user: User) {
    return this.buddy.resumeTextSession(user.id, dto.buddySlug, {
      sessionId: dto.sessionId,
      create: dto.new === true,
    });
  }

  /** List the user's past typed-chat threads with a buddy (history panel). */
  @Get('text-sessions')
  listTextSessions(@Query('buddySlug') buddySlug: string, @CurrentUser() user: User) {
    return this.buddy.listTextSessions(user.id, buddySlug);
  }

  /** Delete a past typed-chat thread from history. */
  @Delete('text-session/:id')
  deleteTextSession(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @CurrentUser() user: User,
  ) {
    return this.buddy.deleteTextSession(user.id, sessionId);
  }

  /** Current-month voice + STT usage for the usage meter. */
  @Get('usage')
  getUsage(@CurrentUser() user: User) {
    return this.buddy.getUsage(user.id);
  }

  /** What the buddy remembers about the user. */
  @Get('memory')
  getMemory(@CurrentUser() user: User) {
    return this.buddy.listMemory(user.id);
  }

  /** Clear all AI Buddy memory for the user. */
  @Delete('memory')
  clearMemory(@CurrentUser() user: User) {
    return this.buddy.clearMemory(user.id);
  }

  /** User rates one buddy reply (👍/👎 + optional reason). */
  @Post('feedback')
  feedback(@Body() dto: FeedbackDto, @CurrentUser() user: User) {
    return this.buddy.submitFeedback(user.id, dto.messageId, dto.rating, dto.reason);
  }

  /** Admin: preview a buddy's voice with sample text. */
  @Post('admin/test-voice')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  testVoice(@Body() dto: TestVoiceDto, @CurrentUser() user: User) {
    return this.buddy.testVoice(user.id, dto.buddySlug, dto.text);
  }

  /** Admin: paginated user feedback (👍/👎) on buddy replies. */
  @Get('admin/feedback')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  feedbackLog(@Query('page') page?: string) {
    return this.buddy.getFeedback(page ? parseInt(page, 10) : 1);
  }

  /** Admin: paginated safety-event audit log. */
  @Get('admin/safety-events')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  safetyEvents(@Query('page') page?: string) {
    return this.buddy.getSafetyEvents(page ? parseInt(page, 10) : 1);
  }
}
