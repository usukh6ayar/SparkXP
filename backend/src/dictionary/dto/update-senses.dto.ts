import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_SENSES, SENSE_FIELD_MAX } from '../senses';

/**
 * One hand-edited sense row from the admin Толь editor. The length bounds come
 * from the same constant `parseSenses` uses, so the AI-sourced and hand-edited
 * paths can't drift apart.
 */
export class SenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SENSE_FIELD_MAX.word)
  word: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SENSE_FIELD_MAX.example)
  example: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SENSE_FIELD_MAX.translation)
  translation: string;
}

/** PATCH /dictionary/admin/entries/:id body. */
export class UpdateSensesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SENSES)
  @ValidateNested({ each: true })
  @Type(() => SenseDto)
  senses: SenseDto[];
}
