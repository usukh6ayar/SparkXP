import { IsString, IsOptional } from 'class-validator';

export class BroadcastNotificationDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  targetRole?: string | null;
}
