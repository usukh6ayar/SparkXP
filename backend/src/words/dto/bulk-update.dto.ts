import { IsArray, IsUUID, IsOptional, IsEnum, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WordStatus, ContentLevel } from '../../common/enums';

/** Fields that can be changed across many words at once. */
export class BulkChangesDto {
  @IsOptional()
  @IsEnum(WordStatus)
  status?: WordStatus;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(ContentLevel)
  level?: ContentLevel;
}

/** Body for PATCH /api/words/bulk. */
export class BulkUpdateDto {
  @IsArray()
  @IsUUID('all', { each: true })
  ids: string[];

  @ValidateNested()
  @Type(() => BulkChangesDto)
  changes: BulkChangesDto;
}
