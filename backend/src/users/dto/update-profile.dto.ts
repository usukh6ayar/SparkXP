import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { MN_PROVINCES } from '../../common/enums';
import { IsUsername } from '../../common/validation/username';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  /**
   * New login handle. Unique across users — the service answers 409 when it is
   * already taken. Same rules as sign-up (see `IsUsername`).
   */
  @IsOptional()
  @IsUsername()
  username?: string;

  @IsOptional()
  @IsString()
  @IsIn([...MN_PROVINCES])
  province?: string;

  // Free-form (matches register.dto): districts only exist for Ulaanbaatar, so
  // constraining every district to UB_DISTRICTS would 400 the WHOLE payload for
  // a non-UB user and silently drop their province too.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  /** Image URL or a `default:avN` key (set when picking a default avatar). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  avatarUrl?: string;

  /** Placement / CEFR level (a1..c2). */
  @IsOptional()
  @IsString()
  @MaxLength(5)
  level?: string;

  /** English name the student goes by. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  englishName?: string;
}
