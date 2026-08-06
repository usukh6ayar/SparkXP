import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';

/** Admin: create a buddy background. */
export class CreateBackgroundDto {
  @IsString()
  @MaxLength(120)
  name: string;

  /** Scene image URL (Cloudinary/R2). */
  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceSparks?: number;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsDateString()
  seasonalStart?: string;

  @IsOptional()
  @IsDateString()
  seasonalEnd?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

/** Admin: partial update — every field optional. */
export class UpdateBackgroundDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceSparks?: number;

  @IsOptional()
  @IsBoolean()
  isPremium?: boolean;

  @IsOptional()
  @IsDateString()
  seasonalStart?: string;

  @IsOptional()
  @IsDateString()
  seasonalEnd?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
