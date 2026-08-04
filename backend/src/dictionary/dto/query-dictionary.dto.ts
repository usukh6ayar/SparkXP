import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** GET /dictionary/admin/entries query. */
export class QueryDictionaryDto {
  /** Substring match on the word (case-insensitive). */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** `searches` (default) = most-searched first; `recent` = newest first. */
  @IsOptional()
  @IsIn(['searches', 'recent'])
  sort?: 'searches' | 'recent';
}
