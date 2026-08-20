import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
  IsString,
  IsArray,
  IsInt,
  Min,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ValidateNested, ArrayNotEmpty } from 'class-validator';
import { AssignmentType } from '../../common/enums';

/**
 * Нэг илгээлтийн доторх **нэг сэдвийн** даалгавар.
 *
 * Багш «Present Simple»-ээс 3, «Modal verbs»-ээс 2 асуулт сонгож нэг дор
 * явуулахад сэдэв бүр өөрийн тестээс ирдэг тул ийм мөр 2 болно.
 */
export class AssignmentTargetDto {
  /** Оноох хичээл/сорилын id. */
  @IsUUID()
  targetId: string;

  /** Тухайн тестээс сонгосон асуултын индексүүд. Хоосон = бүх асуулт. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  questionIndexes?: number[];
}

/**
 * Body for POST /api/assignments. A teacher points a class at a lesson or quiz,
 * optionally with a due date.
 */
export class CreateAssignmentDto {
  @IsUUID()
  classId: string;

  @IsEnum(AssignmentType)
  type: AssignmentType;

  /**
   * Оноох ганц хичээл/сорилын id.
   *
   * ⚠️ `targets`-тэй **хоёуланг нь** өгч болохгүй, аль нэгийг нь заавал өг.
   * Энэ талбар нь нэг зүйл оноох богино хэлбэр (админ панел, хуучин апп
   * үүнийг ашигладаг тул хэвээр үлдэв).
   */
  @IsOptional()
  @IsUUID()
  targetId?: string;

  /**
   * Нэг дор оноох **олон** зүйл — сэдэв тус бүрд нэг мөр (`AssignmentTargetDto`).
   * Сурагч руу мэдэгдэл нэг л очно.
   */
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AssignmentTargetDto)
  targets?: AssignmentTargetDto[];

  /** Optional ISO-8601 due date. */
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  /** Optional teacher note. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Target specific students (must be in the class). Omit = whole class. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  studentIds?: string[];

  /**
   * `targetId`-тай хамт өгөх асуултын индексүүд (0-оос эхэлнэ). Хоосон = бүгд.
   *
   * Даалгаврын сангийн нэг тест 15 асуулттай байхад багш 5-ыг сонгож өгөх зам
   * (`Assignment.questionIndexes`). Олон сэдэв өгөх бол `targets`-ыг ашигла.
   * Зөвхөн `type: 'quiz'`-д хүчинтэй.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  questionIndexes?: number[];
}
