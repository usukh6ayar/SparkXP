import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PROMO_AUDIENCES,
  PROMO_KINDS,
  type PromoAudience,
  type PromoKind,
} from '../../entities/promo-code.entity';

/** Letters, digits and dashes — what a person can type from a poster. */
const CODE_PATTERN = /^[A-Za-z0-9-]{3,32}$/;

export class CreatePromoDto {
  @IsString()
  @MaxLength(120)
  name: string;

  /** Omit to auto-generate ("SPX-7K3Q9P"). */
  @IsOptional()
  @Matches(CODE_PATTERN, { message: 'Код 3–32 тэмдэгт: үсэг, тоо, зураас' })
  code?: string;

  @IsIn(PROMO_KINDS)
  kind: PromoKind;

  @IsInt()
  @Min(1)
  value: number;

  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(PROMO_AUDIENCES)
  audience?: PromoAudience;

  @IsOptional()
  @IsUUID()
  assignedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Campaign knobs only; `null` clears a date/limit. */
export class UpdatePromoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  validFrom?: string | null;

  @IsOptional()
  @IsDateString()
  validUntil?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class GrantInfluencerDto {
  /** Plan the trial opens. */
  @IsUUID()
  planId: string;

  /** Given → grant straight to this account. Omitted → issue a code. */
  @IsOptional()
  @IsEmail()
  email?: string;

  /** Default 7. */
  @IsOptional()
  @IsInt()
  @Min(1)
  days?: number;

  /** Code mode only: how many people may use it (default 1). */
  @IsOptional()
  @IsInt()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RedeemPromoDto {
  @Matches(CODE_PATTERN, { message: 'Код буруу байна' })
  code: string;
}

export class QuotePromoDto extends RedeemPromoDto {
  @IsUUID()
  planId: string;
}
