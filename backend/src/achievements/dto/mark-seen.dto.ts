import { IsArray, IsOptional, IsString } from 'class-validator';

export class MarkSeenDto {
  /** Slugs to mark as celebrated. Omit to clear every outstanding one. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  slugs?: string[];
}
