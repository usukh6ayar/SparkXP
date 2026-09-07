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
  NotFoundException,
  ParseIntPipe,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { BuddyService } from './buddy.service';
import { BuddyTurnStreamService } from './buddy-turn-stream.service';
import {
  AiBuddyEnabledGuard,
  isAiBuddyEnabled,
} from './guards/ai-buddy-enabled.guard';
import {
  StartSessionDto,
  ResumeTextSessionDto,
  TextTurnDto,
  ClientLatencyDto,
  TestVoiceDto,
  FeedbackDto,
} from './dto/buddy-turn.dto';

/** Max uploaded voice clip size (~60s of compressed mono audio). */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

@Controller('ai/buddy')
@UseGuards(JwtAuthGuard)
export class BuddyController {
  constructor(
    private readonly buddy: BuddyService,
    private readonly config: ConfigService,
    private readonly turnStreams: BuddyTurnStreamService,
  ) {}

  /**
   * Whether the AI Buddy feature is open right now.
   *
   * The mobile app calls this on launch and shows its "Тун удахгүй" screen when
   * `enabled` is false, so the feature can be opened later by setting
   * `AI_BUDDY_ENABLED=true` on the server — **no app update, no store review**
   * (CLAUDE.md core rule: limits configurable without an app update).
   *
   * Deliberately not behind `AiBuddyEnabledGuard` — the whole point is to be
   * answerable while the feature is closed.
   */
  @Get('availability')
  availability() {
    return { enabled: isAiBuddyEnabled(this.config) };
  }

  /** Start a new AI Buddy conversation session. */
  @Post('sessions')
  startSession(@Body() dto: StartSessionDto, @CurrentUser() user: User) {
    return this.buddy.startSession(user.id, dto);
  }

  /** End a session and get its length (idempotent). */
  @Post('sessions/:id/end')
  @HttpCode(HttpStatus.OK)
  endSession(@Param('id', ParseUUIDPipe) sessionId: string, @CurrentUser() user: User) {
    return this.buddy.endSession(user.id, sessionId);
  }

  /** AI Buddy usage stats (session counts + practice minutes, today + all-time). */
  @Get('statistics')
  statistics(@CurrentUser() user: User) {
    return this.buddy.getStatistics(user.id);
  }

  /**
   * Voice turn: upload audio → transcript + reply + audio + avatar instruction.
   * Spends Gemini (STT + TTS) and Anthropic credit → gated.
   */
  @Post('sessions/:id/turn/audio')
  @UseGuards(AiBuddyEnabledGuard)
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
    @Body('t0') t0?: string,
    @Body('streamId') streamId?: string,
  ) {
    if (!file) throw new BadRequestException('Аудио файл дутуу байна');
    // multipart тул `t0` нь мөр болж ирнэ (DTO validation multipart дээр
    // ажиллахгүй). Утгагүй бол зүгээр л телеметргүй turn болно.
    const startedAt = Number(t0);
    return this.buddy.audioTurn(
      user.id,
      sessionId,
      file,
      Number.isFinite(startedAt) && startedAt > 0 ? startedAt : undefined,
      streamId,
    );
  }

  /** Text turn: same pipeline, STT skipped. Still spends LLM + TTS → gated. */
  @Post('sessions/:id/turn/text')
  @UseGuards(AiBuddyEnabledGuard)
  textTurn(
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: TextTurnDto,
    @CurrentUser() user: User,
  ) {
    return this.buddy.textTurn(user.id, sessionId, dto.text, dto.t0, dto.streamId);
  }

  /**
   * Аудионы дараагийн хэсгийг ХҮЛЭЭНЭ (урт-хүлээлт).
   *
   * Клиент үүнийг turn-ийн хүсэлттэй **зэрэгцүүлэн** дуудна: хэсэг бэлэн
   * болмогц шууд буцна тул хэрэглэгч бүтэн хариуг хүлээлгүй сонсож эхэлнэ.
   * Хэсэг байхгүй бол `{ chunk: null }` — клиент ердийн `audio_url` руу шилжинэ.
   */
  @Get('turns/:streamId/chunk/:index')
  chunk(
    @Param('streamId') streamId: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: User,
  ) {
    return this.turnStreams.waitFor(streamId, index, user.id);
  }

  /** Тухайн хэсгийн аудио байт — санах ойгоос шууд, R2-г хүлээхгүй. */
  @Get('turns/:streamId/audio/:index')
  async chunkAudio(
    @Param('streamId') streamId: string,
    @Param('index', ParseIntPipe) index: number,
    @CurrentUser() user: User,
    @Res() res: Response,
  ) {
    const audio = this.turnStreams.audioFor(streamId, index, user.id);
    if (!audio) throw new NotFoundException('Аудио хэсэг олдсонгүй');
    // Провайдерын өөрийнх нь формат. Хатуу "audio/mpeg" байсан нь Azure
    // (mp3)-д таарч байсан ч Gemini (wav)-д худал болж, тоглуулагч задлаж
    // чадахгүй — дуугүй turn болдог байв.
    res.setHeader(
      'Content-Type',
      this.turnStreams.mimeFor(streamId, index, user.id) ?? 'audio/mpeg',
    );
    res.setHeader('Content-Length', String(audio.length));
    // Санах ойд түр байдаг тул кэшлүүлэхгүй — URL дахин ашиглагдахгүй.
    res.setHeader('Cache-Control', 'no-store');
    res.end(audio);
  }

  /**
   * Barge-in: хэрэглэгч дундуур нь ярьж эхлэв. Үлдсэн хэсгүүдийг хаяна;
   * ажиллаж буй LLM урсгал дараагийн багц дээрээ өөрөө таслагдана.
   */
  @Post('turns/:streamId/cancel')
  cancelTurn(@Param('streamId') streamId: string, @CurrentUser() user: User) {
    this.turnStreams.abort(streamId, user.id);
    return { ok: true };
  }

  /**
   * Клиентийн латенсийн тайлан (t7/t8/t9) — хэрэглэгчийн бодит хүлээлтийг
   * зөвхөн төхөөрөмж мэднэ. Хариу нь үргэлж `{ ok: true }`: телеметр аппын
   * урсгалыг хэзээ ч зогсоох ёсгүй.
   */
  @Post('turns/client-latency')
  clientLatency(@Body() dto: ClientLatencyDto, @CurrentUser() user: User) {
    return this.buddy.reportClientLatency(user.id, dto);
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
