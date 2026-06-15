import { Type } from 'class-transformer';
import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ContentLevel } from '../../common/enums';

/**
 * Query params for GET /api/words — optional filters + simple pagination.
 * `@Type(() => Number)` converts the string query values to numbers.
 */
export class QueryWordsDto {
  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

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
