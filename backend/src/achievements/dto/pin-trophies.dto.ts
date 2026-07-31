import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { MAX_PINNED_TROPHIES } from '../achievements.service';

export class PinTrophiesDto {
  /** The whole pinned set, in display order. Empty array clears it. */
  @IsArray()
  @ArrayMaxSize(MAX_PINNED_TROPHIES)
  @IsString({ each: true })
  slugs: string[];
}
