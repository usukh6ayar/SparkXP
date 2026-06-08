import { IsString, IsNotEmpty } from 'class-validator';

export class ConfirmPaymentDto {
  /** Gateway-side transaction reference. */
  @IsString()
  @IsNotEmpty()
  providerRef: string;
}
