import { HttpException, HttpStatus } from '@nestjs/common';

/** Error with a machine `code` — the website/app match the code, not the Mongolian message. */
export function paymentError(
  status: HttpStatus,
  code: string,
  message: string,
): HttpException {
  return new HttpException({ statusCode: status, code, message }, status);
}

export const paymentUnavailable = () =>
  paymentError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'PAYMENT_UNAVAILABLE',
    'Төлбөрийн систем түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.',
  );
