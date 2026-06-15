import { IsString, IsInt, IsOptional, IsBoolean, IsArray, Min, MinLength } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  slug: string;

  @IsInt()
  @Min(0)
  priceAmount: number;

  @IsInt()
  @Min(1)
  durationDays: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** AI TTS voice output minutes per month (null = unlimited). */
  @IsOptional()
  @IsInt()
  @Min(0)
  voiceMinutesLimit?: number | null;

  /** STT user speech minutes per month (null = unlimited). */
  @IsOptional()
  @IsInt()
  @Min(0)
  sttMinutesLimit?: number | null;

  /** Gemini AI dictionary explanations per month (null = unlimited). */
  @IsOptional()
  @IsInt()
  @Min(0)
  dictionaryAiLimit?: number | null;

  /** AI text chat tokens per month in thousands (null = unlimited). */
  @IsOptional()
  @IsInt()
  @Min(0)
  aiTextTokensLimit?: number | null;

  /** AI buddy memory storage per user in MB (null = unlimited). */
  @IsOptional()
  @IsInt()
  @Min(0)
  memoryMbLimit?: number | null;
}
