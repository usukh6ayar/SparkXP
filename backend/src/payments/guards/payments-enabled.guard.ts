import {
  Injectable,
  CanActivate,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Opens / closes checkout creation (`POST /payments`).
 *
 * **What it no longer protects.** The old client-callable `POST
 * /payments/:id/confirm` (which granted plans without asking any provider) is
 * gone. Access is now granted ONLY by `POST /payments/webhook/byl`, after its
 * `Byl-Signature` is verified and the checkout is re-read from Byl — that route
 * is deliberately not behind this guard, so a payment completed just before the
 * flag is turned off is still honoured.
 *
 * **Default is OFF.** `PAYMENTS_ENABLED` must be exactly `'true'` — a fresh or
 * misconfigured environment stays closed. Turn it on only once Byl is live
 * (spec 2026-10-14 §9).
 */
@Injectable()
export class PaymentsEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (this.config.get<string>('PAYMENTS_ENABLED') === 'true') return true;

    // 503, not 404: the route exists and is coming back. The message is
    // user-facing (Mongolian) because the mobile app surfaces it directly.
    throw new ServiceUnavailableException(
      'Төлбөрийн систем түр хаалттай байна. Удахгүй нээгдэнэ.',
    );
  }
}
