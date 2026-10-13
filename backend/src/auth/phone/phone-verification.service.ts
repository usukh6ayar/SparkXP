import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { phoneError } from './phone';
import { VerifyMnClient, VerifyMnConflictError } from './verify-mn.client';

export type PhonePurpose = 'register' | 'login' | 'reset' | 'link';

/** What a consumer endpoint gets after the SMS arrived. Single use. */
export interface PhoneProof {
  phone: string;
  purpose: PhonePurpose;
  /** Set for `link` only — the account the number is being attached to. */
  userId: string | null;
}

export interface PhoneStartResult {
  verificationId: string;
  smsUri: string;
  displayInstruction: string;
  expiresAt: string;
}

interface PendingRecord extends PhoneProof {
  vmSessionId: string;
}

/** A verified proof stays spendable this long (the user still has to type a password etc.). */
const PROOF_TTL_SECONDS = 600;
/** Max sessions per phone per window — each SMS costs the user 150₮. */
const RATE_MAX = 3;
const RATE_WINDOW_SECONDS = 600;

const pendingKey = (id: string) => `phonever:pending:${id}`;
const proofKey = (id: string) => `phonever:proof:${id}`;
const rateKey = (phone: string) => `phonever:rate:${phone}`;

/**
 * Two Redis keys per verification:
 * - `pending` — while we wait for the SMS. Holds the verify.mn session id,
 *   which never leaves the server (verify.mn's status endpoint has no auth).
 * - `proof` — written when verify.mn says VERIFIED. Bound to phone + purpose,
 *   spent with GETDEL so two parallel requests can never both use it.
 */
@Injectable()
export class PhoneVerificationService {
  constructor(
    private readonly vm: VerifyMnClient,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async start(
    phone: string,
    purpose: PhonePurpose,
    userId: string | null = null,
  ): Promise<PhoneStartResult> {
    await this.rateLimit(phone);
    const session = await this.createSession(phone);

    const verificationId = randomUUID();
    const record: PendingRecord = {
      phone,
      purpose,
      userId,
      vmSessionId: session.sessionId,
    };
    const ttl = Math.max(
      1,
      Math.ceil((Date.parse(session.expiresAt) - Date.now()) / 1000),
    );
    await this.redis.set(
      pendingKey(verificationId),
      JSON.stringify(record),
      'EX',
      ttl,
    );

    return {
      verificationId,
      smsUri: session.smsUri,
      displayInstruction: session.displayInstruction,
      expiresAt: session.expiresAt,
    };
  }

  async status(
    verificationId: string,
  ): Promise<{ status: 'pending' | 'verified' | 'expired' }> {
    if (await this.redis.exists(proofKey(verificationId)))
      return { status: 'verified' };

    const raw = await this.redis.get(pendingKey(verificationId));
    if (!raw) return { status: 'expired' };
    const record = JSON.parse(raw) as PendingRecord;

    const vmStatus = await this.vm.getStatus(record.vmSessionId);
    if (vmStatus === 'VERIFIED') {
      const proof: PhoneProof = {
        phone: record.phone,
        purpose: record.purpose,
        userId: record.userId,
      };
      await this.redis.set(
        proofKey(verificationId),
        JSON.stringify(proof),
        'EX',
        PROOF_TTL_SECONDS,
      );
      await this.redis.del(pendingKey(verificationId));
      return { status: 'verified' };
    }
    if (vmStatus === 'EXPIRED') {
      await this.redis.del(pendingKey(verificationId));
      return { status: 'expired' };
    }
    return { status: 'pending' };
  }

  /** Spend a proof. Throws unless it exists, is verified and has this purpose. */
  async consume(
    verificationId: string,
    purpose: PhonePurpose,
  ): Promise<PhoneProof> {
    const raw = await this.redis.getdel(proofKey(verificationId));
    if (!raw) {
      // Still waiting for the SMS → the client called too early.
      if (await this.redis.exists(pendingKey(verificationId))) throw invalid();
      throw phoneError(
        HttpStatus.BAD_REQUEST,
        'VERIFICATION_EXPIRED',
        'Баталгаажуулалтын хугацаа дууссан. Дахин эхлүүлнэ үү.',
      );
    }
    const proof = JSON.parse(raw) as PhoneProof;
    if (proof.purpose !== purpose) throw invalid();
    return proof;
  }

  private async createSession(phone: string) {
    try {
      return await this.vm.createSession(phone, newCode());
    } catch (err) {
      // 409 = same phone + same text still active; a new code is a new text.
      if (err instanceof VerifyMnConflictError)
        return this.vm.createSession(phone, newCode());
      throw err;
    }
  }

  private async rateLimit(phone: string): Promise<void> {
    const n = await this.redis.incr(rateKey(phone));
    if (n === 1) await this.redis.expire(rateKey(phone), RATE_WINDOW_SECONDS);
    if (n > RATE_MAX) {
      throw phoneError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_REQUESTS',
        'Хэт олон оролдлого. 10 минутын дараа дахин оролдоно уу.',
      );
    }
  }
}

function newCode(): string {
  return String(randomInt(100000, 1_000_000));
}

function invalid() {
  return phoneError(
    HttpStatus.BAD_REQUEST,
    'VERIFICATION_INVALID',
    'Утас баталгаажаагүй байна.',
  );
}
