import {
  BadRequestException,
  Controller,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SpeakingService } from './speaking.service';

/** Same cap as the buddy voice turn. */
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/**
 * Speaking exercise — pronunciation check. The learner records a word; we
 * transcribe it (reusing the AI-gateway STT) and say whether it matched.
 */
@Controller('speaking')
@UseGuards(JwtAuthGuard)
export class SpeakingController {
  constructor(private readonly speaking: SpeakingService) {}

  /** Upload a recording of `target` → `{ correct, transcript, similarity }`. */
  @Post('check')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  check(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Query('target') target: string,
  ) {
    if (!file) throw new BadRequestException('Аудио файл дутуу байна');
    if (!target?.trim())
      throw new BadRequestException('Зорилтот үг дутуу байна');
    return this.speaking.check(file.buffer, file.mimetype, target);
  }
}
