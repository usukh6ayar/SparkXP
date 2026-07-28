import { Injectable, Logger } from '@nestjs/common';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/** Expo caps a single request at 100 messages. */
const BATCH_SIZE = 100;

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * Sends push notifications through Expo's service.
 *
 * Expo is the right layer here because the app is an Expo build — it fans out
 * to APNs/FCM for us, so there are no Apple/Google credentials to manage in
 * this repo.
 *
 * Delivery is best-effort by design: a failed push must never break the caller
 * (a cron job or an admin broadcast). Every failure is logged, never thrown.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  /** Expo tokens have a fixed shape; anything else is a client bug or stale data. */
  static isValidToken(token: string | null | undefined): boolean {
    if (!token) return false;
    return (
      /^ExponentPushToken\[.+\]$/.test(token) || /^ExpoPushToken\[.+\]$/.test(token)
    );
  }

  /**
   * Delivers messages and reports which tokens Expo rejected as permanently
   * dead (`DeviceNotRegistered`) so the caller can clear them — otherwise we
   * keep pushing to uninstalled apps forever.
   */
  async send(messages: PushMessage[]): Promise<{ sent: number; invalidTokens: string[] }> {
    const valid = messages.filter((m) => PushService.isValidToken(m.to));
    if (valid.length === 0) return { sent: 0, invalidTokens: [] };

    let sent = 0;
    const invalidTokens: string[] = [];

    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const batch = valid.slice(i, i + BATCH_SIZE);
      try {
        const res = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(batch),
        });

        if (!res.ok) {
          this.logger.warn(`Expo push failed: ${res.status} ${res.statusText}`);
          continue;
        }

        const json = (await res.json()) as {
          data?: { status: string; details?: { error?: string } }[];
        };

        json.data?.forEach((ticket, idx) => {
          if (ticket.status === 'ok') {
            sent += 1;
          } else if (ticket.details?.error === 'DeviceNotRegistered') {
            invalidTokens.push(batch[idx].to);
          }
        });
      } catch (err) {
        // Network blip / Expo outage — log and move on.
        this.logger.warn(`Expo push error: ${(err as Error).message}`);
      }
    }

    return { sent, invalidTokens };
  }
}
