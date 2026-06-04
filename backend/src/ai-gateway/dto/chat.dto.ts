import { IsString, IsOptional, IsUUID, MaxLength } from 'class-validator';

export class ChatDto {
  /** The user's message to the AI buddy. */
  @IsString()
  @MaxLength(2000)
  message: string;

  /**
   * Optional conversation thread ID. If provided, the gateway loads prior
   * messages from that thread to send as context. If omitted, a new thread
   * is started and a new UUID is returned.
   */
  @IsOptional()
  @IsUUID()
  conversationId?: string;
}
