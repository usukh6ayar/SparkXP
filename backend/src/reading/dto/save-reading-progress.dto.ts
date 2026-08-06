import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class SaveReadingProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sentenceIndex: number;
}
