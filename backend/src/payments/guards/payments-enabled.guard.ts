import {
  Injectable,
  CanActivate,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Blocks every money-moving payment route until QPay is genuinely integrated.
 *
 * **Why this exists.** `PaymentsService.confirm()` flips a payment to PAID and
 * hands out a subscription plan or Sparks. It is reached over `POST
 * /payments/:id/confirm`, which is protected by nothing but `JwtAuthGuard` and
 * does not verify anything with QPay — `createIntent()` still returns a stub
 * URL and carries a `// TODO: call real QPay API here`. So any registered user
 * could create an intent and immediately confirm it themselves, granting
 * themselves premium for free.
 *
 * **Default is OFF.** `PAYMENTS_ENABLED` must be explicitly set to `'true'`,
 * so a fresh environment (a new staging database, a misconfigured production
 * deploy) is closed rather than open. Turning it on is a deliberate act.
 *
 * **Before flipping it on, `confirm` must stop being a client-callable route.**
 * The real design is a QPay server-to-server callback whose signature is
 * verified; the mobile app should only ever poll payment status. Enabling this
 * flag without that change re-opens the same hole.
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
