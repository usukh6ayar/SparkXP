import {
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  IsUUID,
  IsString,
} from 'class-validator';
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

  /** Filter by sub-category (сэдэв) within a skill. */
  @IsOptional()
  @IsString()
  topic?: string;

  /** When true, return only standalone quizzes (Дасгал) — those with no lesson. */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  standalone?: boolean;

  /**
   * Хариулах боломжгүй дасгалыг ч оруулах эсэх (анхдагч: **үгүй**).
   *
   * Сонсох яриагүй сонсголын дасгал бол сурагчид эх мэдээлэл өгөлгүй асуулт
   * асуусан хэрэг. Ийм хуучин мөрүүд DB-д үлдсэн тул жагсаалт нь **анхдагчаар
   * тэдгээрийг нуудаг** — өөрөөр хэлбэл аппын аль ч хувилбар (шинэчлэлгүй ч)
   * шууд цэвэр контент авна.
   *
   * Админ энэ тугийг асааж, эвдэрсэн мөрүүдээ хараад засна.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeUnanswerable?: boolean;

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
