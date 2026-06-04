import {
  IsString,
  IsOptional,
  IsIn,
  IsEnum,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MN_PROVINCES, UserRole } from '../../common/enums';

/**
 * Body for PATCH /api/users/:id — an ADMIN editing another user. Allows
 * changing the role and org membership (which a user can't do to themselves).
 */
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsIn([...MN_PROVINCES], { message: 'Аймаг/хот буруу байна' })
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
