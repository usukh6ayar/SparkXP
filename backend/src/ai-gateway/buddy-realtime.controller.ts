import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Sse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { BuddyRealtimeService } from './buddy-realtime.service';
import { RealtimeTextDto } from './dto/realtime-turn.dto';

/** Same cap as the REST voice turn. */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/**
 * Realtime buddy — a streaming layer over the existing turn endpoints.
 *
 * Flow: POST a turn (text or audio) → `{ streamId }` → open the SSE stream to
 * receive `status` · `transcript` · `chunk` · `audio` · `done` (or `error`) →
 * POST interrupt to stop early. The plain `/ai/buddy/sessions/:id/turn/*`
 * endpoints stay the fallback and are untouched.
 */
@Controller('ai/buddy/rt')
@UseGuards(JwtAuthGuard)
export class BuddyRealtimeController {
  constructor(private readonly rt: BuddyRealtimeService) {}

  /** Probe: whether to stream or fall back to the REST turn endpoints. */
  @Get('capabilities')
  capabilities() {
    return this.rt.capabilities();
  }

  /** Start a streamed TEXT turn. */
  @Post('turn/text')
  textTurn(@Body() dto: RealtimeTextDto, @CurrentUser() user: User) {
    return this.rt.startTextTurn(user.id, dto.sessionId, dto.text);
  }

  /** Start a streamed VOICE turn (multipart `file`; session in the path). */
  @Post('turn/audio/:sessionId')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  audioTurn(
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @CurrentUser() user: User,
  ) {
    if (!file) throw new BadRequestException('Аудио файл дутуу байна');
    return this.rt.startAudioTurn(user.id, sessionId, file);
  }

  /** The event stream for a started turn (ownership-checked in the service). */
  @Sse('stream/:streamId')
  stream(
    @Param('streamId', ParseUUIDPipe) streamId: string,
    @CurrentUser() user: User,
  ) {
    return this.rt.stream(user.id, streamId);
  }

  /** Interrupt an in-flight turn. */
  @Post('interrupt/:streamId')
  @HttpCode(200)
  interrupt(
    @Param('streamId', ParseUUIDPipe) streamId: string,
    @CurrentUser() user: User,
  ) {
    return this.rt.interrupt(user.id, streamId);
  }
}
