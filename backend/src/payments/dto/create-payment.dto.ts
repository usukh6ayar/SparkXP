import { IsInt, IsPositive, IsOptional, IsString, IsIn, IsUUID } from 'class-validator';

/** Sparks top-up packages (amount MNT → Sparks credited). */
export const SPARKS_PACKAGES = [
  { amount: 1000, sparks: 50 },
  { amount: 3000, sparks: 180 },
  { amount: 5000, sparks: 350 },
] as const;

export class CreatePaymentDto {
  /**
   * For Sparks top-ups: package amount in MNT (must match SPARKS_PACKAGES).
   * For plan purchases: omit this and provide planId instead.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  amount?: number;

  /** For subscription plan purchase: the Plan UUID. */
  @IsOptional()
  @IsUUID()
  planId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['qpay', 'stripe'])
  provider?: string;
}
