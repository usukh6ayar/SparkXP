import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ORG_TYPE_SUGGESTIONS, MN_PROVINCES, UB_DISTRICTS } from '../../common/enums';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Free-text org type. Common values: school, company, law_firm. */
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsOptional()
  @IsIn(MN_PROVINCES)
  province?: string;

  @IsOptional()
  @IsIn(UB_DISTRICTS)
  district?: string;
}
