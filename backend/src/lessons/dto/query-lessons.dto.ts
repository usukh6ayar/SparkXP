import { Type, Transform } from 'class-transformer';
import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { LessonType, ContentLevel } from '../../common/enums';

/** Query params for GET /api/lessons — optional filters + pagination. */
export class QueryLessonsDto {
  @IsOptional()
  @IsEnum(LessonType)
  type?: LessonType;

  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  // Query values arrive as strings; map "true"/"false" to a real boolean.
  // (Type(() => Boolean) is wrong here: Boolean("false") === true.)
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
