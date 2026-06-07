import {
  IsString,
  IsOptional,
  IsObject,
  MaxLength,
} from 'class-validator';

/**
 * Body for POST /api/organizations. Admins create schools / companies / law
 * firms from the admin panel.
 *
 * `type` is intentionally a free string (not an enum) so new org types can be
 * introduced without a code change. See ORG_TYPE_SUGGESTIONS for defaults.
 */
export class CreateOrganizationDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsString()
  @MaxLength(50)
  type: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  /** Free-form settings (branding, plan-limit overrides, etc.). */
  @IsOptional()
  @IsObject()
  settings?: Record<string, unknown>;
}
