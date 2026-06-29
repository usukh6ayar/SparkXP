import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';

/**
 * Query params for GET /api/idioms — search + pagination. The student app gets
 * only published idioms; the admin passes `all=true` to also see drafts.
 */
export class QueryIdiomDto {
  /** Admin only: when true, return idioms of every status (incl. drafts). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  all?: boolean;

  /** Free-text search over the phrase / Mongolian. */
  @IsOptional()
  @IsString()
  search?: string;

  /** Admin: only idioms missing an image (image_url IS NULL). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  noImage?: boolean;

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
  limit?: number = 50;
}
