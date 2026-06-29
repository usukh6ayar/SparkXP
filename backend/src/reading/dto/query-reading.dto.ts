import { Type, Transform } from 'class-transformer';
import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { ContentLevel } from '../../common/enums';

/**
 * Query params for GET /api/reading — optional filters + simple pagination.
 *
 * The student app gets only published passages. The admin panel passes
 * `all=true` to also see drafts.
 */
export class QueryReadingDto {
  @IsOptional()
  @IsEnum(ContentLevel)
  cefr?: ContentLevel;

  /** Admin only: when true, return passages of every status (incl. drafts). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  all?: boolean;

  /** Free-text search over the title. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;
}
