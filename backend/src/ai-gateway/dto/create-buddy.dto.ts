import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsObject,
  Min,
} from 'class-validator';

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

  // --- Voice + avatar config ---
  @IsOptional() @IsString() voiceId?: string;
  @IsOptional() @IsObject() ttsParams?: Record<string, unknown>;
  @IsOptional() @IsObject() emotionMap?: Record<string, string>;
  @IsOptional() @IsString() avatarAssetUrl?: string;
  @IsOptional() @IsString() avatarThumbUrl?: string;
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
  @IsOptional() @IsString() voiceId?: string;
  @IsOptional() @IsObject() ttsParams?: Record<string, unknown>;
  @IsOptional() @IsObject() emotionMap?: Record<string, string>;
  @IsOptional() @IsString() avatarAssetUrl?: string;
  @IsOptional() @IsString() avatarThumbUrl?: string;
}
