import { IsString, IsUUID, MinLength } from 'class-validator';

/** Body for starting a streamed TEXT turn (audio uses multipart + a form field). */
export class RealtimeTextDto {
  @IsUUID()
  sessionId: string;

  @IsString()
  @MinLength(1)
  text: string;
}
