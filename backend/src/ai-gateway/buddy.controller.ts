import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { BuddyService } from './buddy.service';
import { StartSessionDto, TextTurnDto } from './dto/buddy-turn.dto';

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
}
