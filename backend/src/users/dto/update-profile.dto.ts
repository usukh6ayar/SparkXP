import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator';
import { MN_PROVINCES } from '../../common/enums';

/**
 * Body for PATCH /api/users/me — a user editing their OWN profile.
 * Deliberately excludes email, password, role, xp, sparks (sensitive / not
 * self-editable). Province/district feed the local leaderboards.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  // Province is validated against the known Mongolian list (21 aimags + UB).
  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  // District/sum is free text — only UB's districts are enumerated, aimag sums
  // are not, so we don't hard-validate it here.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;
}
