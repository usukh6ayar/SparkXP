import { IsInt, IsPositive, IsOptional, IsString, IsIn } from 'class-validator';

/** Sparks packages (amount in MNT → Sparks credited on confirmation). */
export const SPARKS_PACKAGES = [
  { amount: 1000, sparks: 50 },
  { amount: 3000, sparks: 180 },
  { amount: 5000, sparks: 350 },
] as const;

export class CreatePaymentDto {
  /** Package amount in MNT tögrög. Must match one of SPARKS_PACKAGES. */
  @IsInt()
  @IsPositive()
  amount: number;

  /** Payment provider — "qpay" or "stripe". Defaults to qpay. */
  @IsOptional()
  @IsString()
  @IsIn(['qpay', 'stripe'])
  provider?: string;
}
