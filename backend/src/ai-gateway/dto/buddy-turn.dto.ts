import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
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
