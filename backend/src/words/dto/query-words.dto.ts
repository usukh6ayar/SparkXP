import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsInt,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { ContentLevel, WordStatus } from '../../common/enums';

/**
 * Query params for GET /api/words — optional filters + simple pagination.
 * `@Type(() => Number)` converts the string query values to numbers.
 *
 * `status` defaults to `published` in the service (student app), so the admin
 * panel passes an explicit status to view drafts / needs_review / etc.
 */
export class QueryWordsDto {
  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  @IsOptional()
  @IsEnum(WordStatus)
  status?: WordStatus;

  /** Admin only: when true, return words of every status (ignores the
   *  published-by-default gating). The student app never sets this. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  all?: boolean;

  @IsOptional()
  @IsString()
  category?: string;

  /** Free-text search over English / Mongolian. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  /** Admin: only words missing an image (image_url IS NULL). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  noImage?: boolean;

  /** Admin: only words missing pronunciation audio (audio_url IS NULL). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  noAudio?: boolean;

  /** Admin: only words that are duplicated (same English appears more than
   *  once, case-insensitive). Lets the admin review dupes before cleaning up. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  duplicates?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50000)
  limit?: number = 20;
}
