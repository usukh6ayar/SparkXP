import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { MN_PROVINCES, UB_DISTRICTS } from '../../common/enums';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn([...MN_PROVINCES])
  province?: string;

  @IsOptional()
  @IsString()
  @IsIn([...UB_DISTRICTS])
  district?: string;

  /** Image URL or a `default:avN` key (set when picking a default avatar). */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  avatarUrl?: string;
}
