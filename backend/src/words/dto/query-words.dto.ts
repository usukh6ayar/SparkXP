import { Type } from 'class-transformer';
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 20;
}
