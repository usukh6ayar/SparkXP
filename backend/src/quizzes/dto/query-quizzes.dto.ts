import { IsOptional, IsEnum, IsBoolean, IsInt, Min, IsUUID, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ContentLevel } from '../../common/enums';

export class QueryQuizzesDto {
  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsUUID()
  lessonId?: string;

  /** Filter by quiz category (e.g. the 4 Дасгал skills: listening/reading/writing/speaking). */
  @IsOptional()
  @IsString()
  category?: string;

  /** When true, return only standalone quizzes (Дасгал) — those with no lesson. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  standalone?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
