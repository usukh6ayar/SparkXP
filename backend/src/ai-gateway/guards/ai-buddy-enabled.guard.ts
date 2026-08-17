import {
  Injectable,
  CanActivate,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Blocks every AI Buddy route that spends money on a third-party API, until the
 * owner deliberately turns the feature on.
 *
 * **Why this exists.** A buddy turn fans out to paid providers — ElevenLabs
 * (STT + TTS) and Anthropic (LLM) — and bills per call. Those costs are meant
 * to be paid for by a subscription, but `PAYMENTS_ENABLED` is off (see
 * `PaymentsEnabledGuard`), so nobody can be charged: every turn is spend the
 * owner absorbs, capped only by the per-plan limits — and the free tier's
 * limits are the loosest of all.
 *
 * **The flag is now ON** by the owner's decision (2026-08-17), knowingly ahead
 * of payments. This guard stays in the code as the kill switch: setting
 * `AI_BUDDY_ENABLED=false` closes the paid routes again with no app update.
 *
 * **It still FAILS CLOSED.** The value must be exactly `'true'`, so a fresh or
 * mistyped environment is closed rather than open — the same rule the payments
 * guard follows, and for the same reason. Never relax that to a truthy check.
 *
 * **What is deliberately NOT guarded:**
 * - Read-only routes (`GET usage`, `statistics`, `memory`, `text-sessions`) and
 *   the DB-only session bookkeeping. They cost nothing, and the "Миний багц"
 *   screen reads `GET /ai/buddy/usage` — 503-ing it would break a screen that
 *   has nothing to do with this flag.
 * - `POST /ai/buddy/admin/test-voice` (admin-only). The owner needs a way to
 *   confirm TTS credentials actually work *before* flipping this flag on.
 * - The AI dictionary (`/dictionary/*`). Gemini is far cheaper per call and
 *   every looked-up word is cached in `dictionary_entries` forever, so repeat
 *   lookups are free. It stays on by owner's decision (2026-08-08).
 *
 * **Flipping it:** set `AI_BUDDY_ENABLED` on Railway. No app update is needed
 * in either direction — the mobile app asks `GET /ai/buddy/availability` and
 * swaps its "Тун удахгүй" screen for the real buddy tab on the next launch.
 */
@Injectable()
export class AiBuddyEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (isAiBuddyEnabled(this.config)) return true;

    // 503, not 404: the route exists and is coming back. The message is
    // user-facing (Mongolian) because the mobile app surfaces it directly.
    throw new ServiceUnavailableException(
      'AI Buddy тун удахгүй нээгдэнэ. Одоогоор хаалттай байна.',
    );
  }
}

/**
 * The single place that reads the flag, so the guard and the availability
 * endpoint can never disagree about what "on" means (a mistyped value must
 * read as OFF in both).
 */
export function isAiBuddyEnabled(config: ConfigService): boolean {
  return config.get<string>('AI_BUDDY_ENABLED') === 'true';
}
