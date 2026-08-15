import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { IeltsModuleKey } from '../ielts';

/**
 * «Бүтэн шалгалт үүсгэх» хүсэлт (админ).
 *
 * Хэсгийн тоо, асуултын тоог ЭНД асуухгүй: тэдгээр нь шалгалтын албан ёсны
 * бүтэц бөгөөд `paperPlan()`-д тогтоогдсон (Listening/Reading 4×10, Writing 2 Task, Speaking 3 Part).
 * Админ зөвхөн аль модуль, ямар сэдвээр гэдгээ хэлнэ.
 */
export class IeltsPaperDto {
  @IsIn(['listening', 'reading', 'writing', 'speaking'])
  module: IeltsModuleKey;

  /** Сэдэв (сонголтоор) — хоосон бол AI өөрөө сонгоно. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;

  /** Гарчиг (сонголтоор) — хоосон бол модулиас автоматаар. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  xpReward?: number;
}
