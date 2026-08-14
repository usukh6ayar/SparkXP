import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsIn,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ContentLevel } from '../../common/enums';
import {
  MAX_QUESTION_COUNT,
  type GenQuestionType,
  type TargetKind,
} from '../ai-generate';

/**
 * "AI-аар үүсгэх" хүсэлт (админ). Хариуд нь **хадгалагдаагүй** ноорог буцна —
 * админ preview дээр хараад, засаад л өөрөө хадгална.
 *
 * `level` / `questionType` / `count` -г орхивол AI өөрөө таамаглаж, юу сонгосноо
 * хариуд нь буцаана ("агуулгаа бичихэд AI өөрөө таних" урсгал).
 */
export class AiGenerateQuizDto {
  /** Админы бичсэн чөлөөт агуулга — юу үүсгэхийг тайлбарласан текст. */
  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  brief: string;

  /** Контент хаашаа очих вэ — дасгал · хичээлийн quiz · IELTS. */
  @IsIn(['exercise', 'lesson', 'ielts'])
  kind: TargetKind;

  /** Quiz.category — ж: 'listening' · 'Дүрэм' · 'ielts_reading'. */
  @IsOptional()
  @IsString()
  category?: string;

  /**
   * Сорилын тоглоомын төрөл. **Сорил** хуудсаар үүсгэхэд `category: 'soril'`
   * тул ур чадвар нь ЭНД байдаг — чанарын сонсголын шалгалт ба «яриа заавал»
   * дүрэм үүнийг харна (`quizSkill()`).
   */
  @IsOptional()
  @IsString()
  quizType?: string;

  /** Quiz.topic (сэдэв). Хоосон бол AI санал болгоно. */
  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;

  @IsOptional()
  @IsIn(['multiple_choice', 'fill_blank', 'word_match', 'open_response'])
  questionType?: GenQuestionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_QUESTION_COUNT)
  count?: number;

  /** IELTS Reading — өгсөн эх бичвэр. Хоосон бол AI өөрөө зохионо. */
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  passageText?: string;

  /**
   * Prompt-д нэмэх нэмэлт контекст — ж: хичээлийн товч агуулга, сорилын
   * тоглоомын төрөл. Админы хуудас өөрт байгаа мэдээллээ эндүүр дамжуулна
   * (backend-д Lesson repo нэмэх шаардлагагүй).
   */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  contextNote?: string;
}
