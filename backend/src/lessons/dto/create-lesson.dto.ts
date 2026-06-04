import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsObject,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';
import { LessonType, ContentLevel } from '../../common/enums';

/** Body for POST /api/lessons. Lessons are authored from the admin panel. */
export class CreateLessonDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(LessonType)
  type: LessonType;

  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  /**
   * Flexible per-type body (slides, audio refs, grammar notes, ...). Shape
   * varies by `type`; stored as jsonb. Validated loosely here as an object.
   */
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  /** Display order within a level/track. */
  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  /** Cost in Sparks to unlock. 0 = free. */
  @IsOptional()
  @IsInt()
  @Min(0)
  priceSparks?: number;

  /** Null/omitted = global content; set = org-specific track. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
