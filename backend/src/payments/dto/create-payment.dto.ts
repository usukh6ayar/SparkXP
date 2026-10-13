import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/** POST /payments and GET /payments/quote — plans only (Sparks packs come later). */
export class CreatePaymentDto {
  @IsUUID()
  planId: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  promoCode?: string;
}
