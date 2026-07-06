import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { BuddySessionMode } from '../../common/enums';

/** Start an AI Buddy conversation session. */
export class StartSessionDto {
  @IsString()
  buddySlug: string;

  @IsOptional()
  @IsIn([BuddySessionMode.VOICE, BuddySessionMode.TEXT])
  mode?: BuddySessionMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
}

/** A typed (text) turn — STT is skipped. */
export class TextTurnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;
}

/** Admin: preview a buddy's TTS voice with a sample line. */
export class TestVoiceDto {
  @IsString()
  buddySlug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text: string;
}

/** User feedback (👍/👎 + optional reason) on one AI Buddy reply. */
export class FeedbackDto {
  @IsUUID()
  messageId: string;

  @IsIn(['up', 'down'])
  rating: 'up' | 'down';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
