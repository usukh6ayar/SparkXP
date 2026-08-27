import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
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

/**
 * Open a typed-chat thread: a specific `sessionId`, a brand-new thread
 * (`new: true`), or (default) the most recent one for this buddy.
 */
export class ResumeTextSessionDto {
  @IsString()
  buddySlug: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsBoolean()
  new?: boolean;
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

/**
 * User feedback on one AI Buddy reply.
 *
 * `up`/`down` are quality signals. **`report` is different**: it is the
 * "this reply was offensive/harmful" channel that Google Play's Generative AI
 * policy requires an app to offer for AI-generated content, so it additionally
 * raises a `safety_events` row for the admin audit log. Keeping it in the same
 * endpoint (rather than a second one) means the client sends the same payload
 * either way and the message is looked up + ownership-checked once.
 */
export class FeedbackDto {
  @IsUUID()
  messageId: string;

  @IsIn(['up', 'down', 'report'])
  rating: 'up' | 'down' | 'report';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
