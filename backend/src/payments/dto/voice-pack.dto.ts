import { OmitType, PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

/** Admin: a pay-as-you-go pack of extra AI Buddy minutes. */
export class CreateVoicePackDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  slug: string;

  /** Byl's floor is 100₮. */
  @IsInt()
  @Min(100)
  priceAmount: number;

  @IsInt()
  @Min(0)
  voiceMinutes: number;

  @IsInt()
  @Min(0)
  sttMinutes: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** Admin edit; the slug is fixed (the website links by it). */
export class UpdateVoicePackDto extends PartialType(
  OmitType(CreateVoicePackDto, ['slug'] as const),
) {}

/** POST /payments/packs/checkout */
export class BuyVoicePackDto {
  @IsUUID()
  packId: string;
}
