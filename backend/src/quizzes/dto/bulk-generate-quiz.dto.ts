import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ContentLevel } from '../../common/enums';
import { MAX_QUESTION_COUNT, type TargetKind } from '../ai-generate';
import { MAX_PER_TARGET, MAX_TARGETS } from '../bulk-generate';

/** Нэг төрөл — Сонсгол · Үг таах · IELTS Reading гэх мэт. */
export class BulkTargetDto {
  /** `Quiz.category` — апп контентыг үүгээр татдаг. */
  @IsString()
  @MaxLength(60)
  category: string;

  /** Админд харагдах нэр. AI-д ч контекст болж очно. */
  @IsString()
  @MaxLength(60)
  label: string;

  /**
   * Тараах сэдвүүд (`Quiz.topic`). Апп дасгалыг сэдвээр нь бүлэглэдэг тул
   * админы бэлэн жагсаалтыг дамжуулна. Хоосон бол сэдэвгүй дасгал үүснэ.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  topics?: string[];

  @IsOptional()
  @IsIn(['multiple_choice', 'fill_blank', 'word_match', 'open_response'])
  questionType?: string;

  /** Сорилын тоглоомын төрөл — хадгалахад `Quiz.quizType` болно. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  quizType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  contextNote?: string;
}

/**
 * "Бүх төрлөөр үүсгэх" хүсэлт. Админ **агуулга бичихгүй** — зөвхөн түвшин ба
 * хэмжээгээ сонгоно; ямар төрөл, ямар сэдэв байхыг хуудас өөрөө мэддэг тул
 * `targets`-аар дамжуулна (backend-д ангиллын хүснэгт хуулбарлахгүйн тулд).
 *
 * Хариу нь `jobId` — үүсгэлт background-д явна (40 дасгал ≈ 3 минут).
 */
export class BulkGenerateQuizDto {
  @IsIn(['exercise', 'lesson', 'ielts'])
  kind: TargetKind;

  /** Түвшинг админ ЗААВАЛ сонгоно — энэ онцлогийн гол цэг нь тэр. */
  @IsEnum(ContentLevel)
  level: ContentLevel;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TARGETS)
  @ValidateNested({ each: true })
  @Type(() => BulkTargetDto)
  targets: BulkTargetDto[];

  /** Төрөл бүрт хэдэн дасгал үүсгэх вэ. */
  @IsInt()
  @Min(1)
  @Max(MAX_PER_TARGET)
  perTarget: number;

  /** Нэг дасгалд хэдэн асуулт байх вэ. */
  @IsInt()
  @Min(1)
  @Max(MAX_QUESTION_COUNT)
  questionCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(500)
  xpReward?: number;
}
