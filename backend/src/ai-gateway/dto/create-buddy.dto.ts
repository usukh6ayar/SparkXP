import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class CreateBuddyDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  emoji: string;

  @IsString()
  systemPrompt: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraMessagesAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  extraMessagesCost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  voiceMinuteCost?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateBuddyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() emoji?: string;
  @IsOptional() @IsString() systemPrompt?: string;
  @IsOptional() @IsInt() @Min(0) extraMessagesAmount?: number;
  @IsOptional() @IsInt() @Min(0) extraMessagesCost?: number;
  @IsOptional() @IsInt() @Min(0) voiceMinuteCost?: number | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}
