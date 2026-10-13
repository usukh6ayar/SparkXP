import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { paymentUnavailable } from '../payments-errors';

/** https://byl.mn/docs — REST, JSON, Bearer token, one project per id. */
const BASE = 'https://byl.mn/api/v1';
const TIMEOUT_MS = 10_000;

export interface BylCheckoutStatus {
  id: number;
  status: 'open' | 'pending' | 'complete' | 'expired';
  /** Decimal as a STRING on checkouts, e.g. "56000.000000000000". */
  amount_total: string;
  client_reference_id: string | null;
}

@Injectable()
export class BylClient implements OnModuleInit {
  private readonly logger = new Logger(BylClient.name);

  constructor(private readonly config: ConfigService) {}

  private get token() {
    return this.config.get<string>('BYL_API_TOKEN') ?? '';
  }
  private get projectId() {
    return this.config.get<string>('BYL_PROJECT_ID') ?? '';
  }

  onModuleInit(): void {
    if (!this.token || !this.projectId)
      this.logger.warn(
        'BYL_API_TOKEN / BYL_PROJECT_ID not set — checkout answers 503',
      );
  }

  /** POST /projects/:id/checkouts → { id, url }. `body` is Byl's checkout shape. */
  async createCheckout(
    body: Record<string, unknown>,
  ): Promise<{ id: number; url: string }> {
    const data = await this.call<{ id: number; url: string }>('/checkouts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { id: data.id, url: data.url };
  }

  async getCheckout(id: number | string): Promise<BylCheckoutStatus> {
    return this.call<BylCheckoutStatus>(
      `/checkouts/${encodeURIComponent(String(id))}`,
      { method: 'GET' },
    );
  }

  private async call<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.token || !this.projectId) throw paymentUnavailable();
    let res: Response;
    try {
      res = await fetch(`${BASE}/projects/${this.projectId}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json', // without it Byl answers errors as HTML
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(
        `Byl unreachable: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw paymentUnavailable();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      // 503 = project misconfigured (no bank account, no Byl plan…) — the owner must act.
      this.logger.error(
        `Byl ${init.method} ${path} → ${res.status} ${JSON.stringify(body)}`,
      );
      throw paymentUnavailable();
    }
    return ((await res.json()) as { data: T }).data;
  }
}
