import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { phoneError } from './phone';

/**
 * verify.mn — Mongolian MO-SMS verification (https://verify.mn).
 *
 * The USER texts a code from their own phone to 144773; verify.mn matches the
 * sender number + text and flips the session to VERIFIED. We never send SMS.
 *
 * - No callback: verify.mn's callback is unsigned, so we poll instead.
 * - `GET /sessions/:id` needs no auth, so a session id must never reach the app.
 * - The API key is never logged.
 */
const API = 'https://api.verify.mn';
const TIMEOUT_MS = 5_000;
/** Fake mode: a session verifies itself this long after it starts. */
const FAKE_DELAY_MS = 3_000;
const FAKE_TTL_MS = 300_000;

export interface VerifyMnSession {
  sessionId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

export type VerifyMnStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED';

/** 409 — a session with the same phone + text is still active. Retry with a new code. */
export class VerifyMnConflictError extends Error {}

const unavailable = () =>
  phoneError(
    HttpStatus.SERVICE_UNAVAILABLE,
    'SMS_UNAVAILABLE',
    'SMS баталгаажуулалт түр ажиллахгүй байна. Түр хүлээгээд дахин оролдоно уу.',
  );

@Injectable()
export class VerifyMnClient implements OnModuleInit {
  private readonly logger = new Logger(VerifyMnClient.name);

  constructor(private readonly config: ConfigService) {}

  /** Dev/Expo Go only: verify every session after 3 s without a key or an SMS. */
  private get fake(): boolean {
    return this.config.get<string>('VERIFY_MN_FAKE') === 'true';
  }

  private get apiKey(): string {
    return this.config.get<string>('VERIFY_MN_API_KEY') ?? '';
  }

  onModuleInit(): void {
    // Fail closed: fake mode in production would let anyone "own" any number.
    if (this.fake && this.config.get<string>('NODE_ENV') === 'production') {
      throw new Error('VERIFY_MN_FAKE=true is not allowed in production');
    }
    if (!this.fake && !this.apiKey) {
      this.logger.warn('VERIFY_MN_API_KEY is not set — phone verification will answer 503');
    }
  }

  async createSession(phone: string, code: string): Promise<VerifyMnSession> {
    if (this.fake) return fakeSession(phone, code);
    if (!this.apiKey) throw unavailable();

    const res = await this.call('/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ phone, text: code }),
    });
    if (res.status === 409) throw new VerifyMnConflictError();
    if (res.status === 401) {
      this.logger.error('verify.mn rejected the API key (401) — check VERIFY_MN_API_KEY');
      throw unavailable();
    }
    if (!res.ok) throw unavailable();

    const body = (await res.json()) as VerifyMnSession;
    return {
      sessionId: body.sessionId,
      smsUri: body.smsUri,
      displayInstruction: body.displayInstruction,
      expiresAt: body.expiresAt,
    };
  }

  async getStatus(sessionId: string): Promise<VerifyMnStatus> {
    if (this.fake) return fakeStatus(sessionId);
    const res = await this.call(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' });
    if (!res.ok) throw unavailable();
    const body = (await res.json()) as { sessionStatus: VerifyMnStatus };
    return body.sessionStatus;
  }

  private async call(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(API + path, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      this.logger.warn(`verify.mn unreachable: ${err instanceof Error ? err.message : String(err)}`);
      throw unavailable();
    }
  }
}

function fakeSession(phone: string, code: string): VerifyMnSession {
  const now = Date.now();
  return {
    sessionId: `fake-${now}`,
    smsUri: `sms:144773?body=${code}`,
    displayInstruction: `Та өөрийн ${phone} дугаараас 144773 дугаарт "${code}" гэж SMS илгээнэ үү. (Хөгжүүлэлтийн горим — 3 секундын дараа автоматаар баталгаажна.)`,
    expiresAt: new Date(now + FAKE_TTL_MS).toISOString(),
  };
}

function fakeStatus(sessionId: string): VerifyMnStatus {
  const started = Number(sessionId.replace('fake-', ''));
  return Date.now() - started >= FAKE_DELAY_MS ? 'VERIFIED' : 'PENDING';
}
