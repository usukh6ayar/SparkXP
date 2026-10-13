import {
  HttpStatus,
  Injectable,
  Inject,
  Logger,
  ServiceUnavailableException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { ReferralsService } from '../referrals/referrals.service';
import { XpService } from '../xp/xp.service';
import { XpSource } from '../common/enums';
import { REDIS_CLIENT } from '../redis/redis.module';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserIdentity } from '../entities/user-identity.entity';
import { PhoneVerificationService } from './phone/phone-verification.service';
import { normalizePhone, phoneError, tryNormalizePhone } from './phone/phone';
import type { RegisterPhoneDto } from './phone/dto/phone.dto';

/** Cost factor for bcrypt. 10 is a good default for an MVP. */
const BCRYPT_ROUNDS = 10;
/** OTP codes live for 10 minutes. */
const OTP_TTL_SECONDS = 600;
/** A pending referral code is held until the user verifies (24h grace). */
const REFERRAL_PENDING_TTL = 24 * 60 * 60;
/** A pending taste-task completion is held until the user verifies (same 24h). */
const TASTE_PENDING_TTL = 24 * 60 * 60;

/** What the API returns on successful login / verify. */
export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

/** User fields safe to send to the client (never the password hash). */
export interface PublicUser {
  id: string;
  email: string | null;
  username: string | null;
  fullName: string;
  role: string;
  xp: number;
  sparks: number;
  emailVerified: boolean;
  avatarUrl: string | null;
  level: string | null;
  province: string | null;
  district: string | null;
  /** Normalised 8-digit phone — only when verified, else null. */
  phone: string | null;
  phoneVerified: boolean;
  /**
   * True → the app must show the phone gate. Email/password accounts without a
   * verified phone; never Google/Apple accounts (Apple 5.1.1 — don't force a
   * phone on Sign in with Apple users). The ONE source of truth for the gate.
   */
  needsPhone: boolean;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    private readonly referrals: ReferralsService,
    private readonly xp: XpService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
    private readonly phone: PhoneVerificationService,
  ) {}

  /**
   * Create a new account (unverified) and email an OTP. No token is returned
   * yet — the user must verify the code via `verifyOtp` to log in.
   */
  async register(dto: RegisterDto): Promise<{ pendingVerification: true; email: string }> {
    if (await this.usersService.findByEmail(dto.email)) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }
    // Same check profile-edit uses (case-insensitive), so a handle can't be
    // taken twice just by changing its capitalisation.
    await this.usersService.assertUsernameFree(dto.username);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      emailVerified: false,
      level: dto.level ?? null,
      province: dto.province ?? null,
      district: dto.district ?? null,
    });

    // Hold any referral code until the email is verified (then it's consumed).
    if (dto.referralCode?.trim()) {
      await this.redis.set(
        this.referralKey(dto.email),
        dto.referralCode.trim(),
        'EX',
        REFERRAL_PENDING_TTL,
      );
    }

    // Hold a taste-task completion → onboarding XP is granted on first verify.
    if (dto.tasteCompleted) {
      await this.redis.set(this.tasteKey(dto.email), '1', 'EX', TASTE_PENDING_TTL);
    }

    // If the code cannot be emailed, the account must not survive. Registration
    // creates the row BEFORE sending, so a failed send used to leave an
    // unverified account behind: the user saw a 500, retried, and hit
    // "this email is already registered" — permanently stuck, with no way to
    // reach the resend button they never got to. Rolling back lets them simply
    // try again. (Observed in production on 2026-08-06 with a misconfigured
    // SMTP setup.)
    try {
      await this.sendOtp('verify', dto.email);
    } catch (err) {
      await this.usersService.remove(user.id).catch(() => {
        // Rollback failed too — log loudly; the row will need clearing by hand.
        this.logger.error(`Rollback failed for ${dto.email} after mail error`);
      });
      this.logger.error(
        `Registration aborted for ${dto.email}: verification email failed — ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new ServiceUnavailableException(
        'Баталгаажуулах имэйл илгээхэд алдаа гарлаа. Түр хүлээгээд дахин оролдоно уу.',
      );
    }
    return { pendingVerification: true, email: dto.email };
  }

  /** Confirm the email with the OTP, then log the user in. */
  async verifyOtp(email: string, code: string): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('Хэрэглэгч олдсонгүй');

    await this.consumeOtp('verify', email, code);
    const firstVerification = !user.emailVerified;
    if (firstVerification) {
      await this.usersService.markEmailVerified(user.id);
      user.emailVerified = true;
      await this.grantSignupBonuses(user, {
        referralCode: await this.takeRedis(this.referralKey(email)),
        tasteCompleted: (await this.takeRedis(this.tasteKey(email))) !== null,
      });
    }

    return this.buildAuthResult(user);
  }

  /** Re-send the verification OTP (e.g. the first email was missed). */
  async resendOtp(email: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(email);
    if (user && !user.emailVerified) await this.sendOtp('verify', email);
    return { ok: true };
  }

  /** Verify credentials (username OR email) and return a fresh token. */
  async login(dto: LoginDto): Promise<AuthResult> {
    const identifier = (dto.identifier ?? dto.email ?? '').trim();
    // 8-digit Mongolian mobile → the account holding that VERIFIED phone. Falls
    // back to username/email on a miss, so an all-digit username still works.
    const phone = tryNormalizePhone(identifier);
    const user = !identifier
      ? null
      : phone
        ? ((await this.usersService.findByVerifiedPhone(phone)) ??
          (await this.usersService.findByUsernameOrEmail(identifier)))
        : await this.usersService.findByUsernameOrEmail(identifier);
    // Same error whether the identifier or password is wrong — don't leak which.
    // `passwordHash` is null on a Google/Apple-only account: there is no
    // password to compare, so password login simply fails. The message stays
    // identical so this can't be used to enumerate which accounts are social.
    if (
      !user ||
      user.passwordHash === null ||
      !(await bcrypt.compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Нэвтрэх нэр эсвэл нууц үг буруу байна');
    }

    // The email OTP was optional in practice: `register` creates the row with
    // `emailVerified: false` and nothing here ever looked at it, so a user could
    // back out of the OTP screen and simply log in — the verification step, the
    // referral bonus and the onboarding XP that hang off `verifyOtp` were all
    // skippable, and an address nobody owns could hold an account.
    //
    // 403 with a code (not 401) so the app can tell this apart from a wrong
    // password and send the user to the OTP screen instead of showing
    // "нэр эсвэл нууц үг буруу". Matching by code, never by message — the
    // message is user-facing Mongolian and would break the moment it is
    // reworded or translated.
    //
    // The code is NOT re-sent here: `login` must stay side-effect-free, or an
    // attacker holding an address could send it mail on demand. The app calls
    // `resend-otp` from the screen it lands on.
    // A phone-verified account is verified — its email (if any) is optional.
    if (!user.emailVerified && !user.phoneVerifiedAt) {
      throw new ForbiddenException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Имэйлээ баталгаажуулна уу.',
        email: user.email,
      });
    }

    return this.buildAuthResult(user);
  }

  /** Start password recovery: email a reset code. Always "ok" (no user leak). */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(email);
    // Only a VERIFIED address: an unverified one may belong to someone else
    // (phone sign-up stores email unverified) — sending them a reset code
    // would hand over the account.
    if (user?.emailVerified) await this.sendOtp('reset', email);
    return { ok: true };
  }

  /** Finish password recovery: validate the code and set a new password. */
  async resetPassword(email: string, code: string, password: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.emailVerified) throw new BadRequestException('Хэрэглэгч олдсонгүй');

    await this.consumeOtp('reset', email, code);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.usersService.setPasswordHash(user.id, passwordHash);
    return { ok: true };
  }

  // ── Phone (verify.mn) ───────────────────────────────────────────────────

  /** SMS-before check so nobody pays 150₮ to learn their username is taken. */
  async checkAvailability(
    username?: string,
    phone?: string,
  ): Promise<{ username?: boolean; phone?: boolean }> {
    const out: { username?: boolean; phone?: boolean } = {};
    if (username) out.username = await this.usersService.isUsernameFree(username.trim());
    if (phone) out.phone = !(await this.usersService.isPhoneTaken(normalizePhone(phone)));
    return out;
  }

  /** Start a public verification. register: number must be free; login/reset: must exist. */
  async startPhone(rawPhone: string, purpose: 'register' | 'login' | 'reset') {
    const phone = normalizePhone(rawPhone);
    const taken = await this.usersService.isPhoneTaken(phone);
    if (purpose === 'register' && taken) throw phoneTaken();
    if (purpose !== 'register' && !taken) throw phoneNotFound();
    return this.phone.start(phone, purpose);
  }

  /** Start linking a phone to the logged-in account. */
  async startLinkPhone(user: User, rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (await this.usersService.isPhoneTaken(phone, user.id)) throw phoneTaken();
    return this.phone.start(phone, 'link', user.id);
  }

  /** Create an account whose phone is already proven → logged in. */
  async registerWithPhone(dto: RegisterPhoneDto): Promise<AuthResult> {
    // Cheap checks first, so a failure doesn't burn the user's proof.
    await this.usersService.assertUsernameFree(dto.username);
    const email = dto.email?.trim() || null;
    if (email && (await this.usersService.findByEmail(email))) {
      throw phoneError(
        HttpStatus.CONFLICT,
        'EMAIL_TAKEN',
        'Энэ имэйл өөр дансанд бүртгэлтэй. Хоосон орхиж болно.',
      );
    }

    const proof = await this.phone.consume(dto.verificationId, 'register');
    if (await this.usersService.isPhoneTaken(proof.phone)) throw phoneTaken();

    let user: User;
    try {
      user = await this.usersService.create({
        email,
        username: dto.username.trim(),
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        fullName: dto.fullName.trim(),
        emailVerified: false,
        phone: proof.phone,
        phoneVerifiedAt: new Date(),
        level: dto.level ?? null,
        province: dto.province ?? null,
        district: dto.district ?? null,
      });
    } catch (err) {
      throw mapUniqueViolation(err);
    }

    await this.grantSignupBonuses(user, {
      referralCode: dto.referralCode?.trim() || null,
      tasteCompleted: dto.tasteCompleted,
    });
    return this.buildAuthResult(user);
  }

  /** «SMS-ээр нэвтрэх» — no password. */
  async loginWithPhone(verificationId: string): Promise<AuthResult> {
    const proof = await this.phone.consume(verificationId, 'login');
    return this.buildAuthResult(await this.accountForPhone(proof.phone));
  }

  /** Reset by phone, then log straight in. */
  async resetWithPhone(verificationId: string, password: string): Promise<AuthResult> {
    const proof = await this.phone.consume(verificationId, 'reset');
    const user = await this.accountForPhone(proof.phone);
    await this.usersService.setPasswordHash(user.id, await bcrypt.hash(password, BCRYPT_ROUNDS));
    return this.buildAuthResult(user);
  }

  /** Attach a proven phone to the caller. Returns the refreshed public user. */
  async linkPhone(caller: User, verificationId: string): Promise<PublicUser> {
    const proof = await this.phone.consume(verificationId, 'link');
    // The proof must have been started BY this account — otherwise anyone who
    // learned a verificationId could attach that number to themselves.
    if (proof.userId !== caller.id) {
      throw phoneError(HttpStatus.BAD_REQUEST, 'VERIFICATION_INVALID', 'Утас баталгаажаагүй байна.');
    }
    try {
      await this.usersService.setVerifiedPhone(caller.id, proof.phone);
    } catch (err) {
      throw mapUniqueViolation(err);
    }
    const fresh = await this.usersService.findById(caller.id);
    return this.publicUser(fresh ?? caller);
  }

  private async accountForPhone(phone: string): Promise<User> {
    const user = await this.usersService.findByVerifiedPhone(phone);
    if (!user) throw phoneNotFound();
    return user;
  }

  /** Read-and-delete a pending Redis value (referral / taste markers). */
  private async takeRedis(key: string): Promise<string | null> {
    const value = await this.redis.get(key);
    if (value !== null) await this.redis.del(key);
    return value;
  }

  /**
   * One-time rewards for a brand-new, verified account: the inviter's referral
   * and the pre-signup taste-task XP. Guarded — a reward hiccup must never
   * block the sign-up itself.
   */
  private async grantSignupBonuses(
    user: User,
    opts: { referralCode?: string | null; tasteCompleted?: boolean },
  ): Promise<void> {
    if (opts.referralCode) {
      try {
        await this.referrals.applyReferralOnVerify(user, opts.referralCode);
      } catch (err) {
        this.logger.warn(`Referral apply failed for ${user.id}: ${String(err)}`);
      }
    }
    if (opts.tasteCompleted) {
      try {
        await this.xp.awardOnce({
          userId: user.id,
          amount: (await this.xp.rewards()).onboarding,
          source: XpSource.ONBOARDING,
          referenceId: user.id,
        });
      } catch (err) {
        this.logger.warn(`Onboarding bonus failed for ${user.id}: ${String(err)}`);
      }
    }
  }

  // ── OTP helpers ─────────────────────────────────────────────────────────

  private otpKey(purpose: 'verify' | 'reset', email: string): string {
    return `otp:${purpose}:${email.toLowerCase()}`;
  }

  /** Redis key holding the referral code a user registered with, until verify. */
  private referralKey(email: string): string {
    return `referral:pending:${email.toLowerCase()}`;
  }

  private tasteKey(email: string): string {
    return `taste:pending:${email.toLowerCase()}`;
  }

  /** Generate, store (Redis TTL) and email a 6-digit code. */
  private async sendOtp(purpose: 'verify' | 'reset', email: string): Promise<void> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.redis.set(this.otpKey(purpose, email), code, 'EX', OTP_TTL_SECONDS);
    if (purpose === 'verify') await this.mail.sendOtp(email, code);
    else await this.mail.sendPasswordReset(email, code);
  }

  /** Validate a code against Redis and delete it (single-use). Throws if wrong. */
  private async consumeOtp(
    purpose: 'verify' | 'reset',
    email: string,
    code: string,
  ): Promise<void> {
    const key = this.otpKey(purpose, email);
    const stored = await this.redis.get(key);
    if (!stored || stored !== code) {
      throw new BadRequestException('Код буруу эсвэл хугацаа дууссан байна');
    }
    await this.redis.del(key);
  }

  // ── shaping ─────────────────────────────────────────────────────────────

  /** Public so social sign-in returns the exact same session shape. */
  async buildAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: this.jwtService.sign(payload), user: await this.publicUser(user) };
  }

  /** `toPublicUser` + the gate flag (needs one identities lookup). */
  async publicUser(user: User): Promise<PublicUser> {
    const needsPhone =
      user.phoneVerifiedAt === null &&
      (await this.identities.count({ where: { userId: user.id } })) === 0;
    return this.toPublicUser(user, needsPhone);
  }

  /** Maps a User entity to the public shape (drops passwordHash, relations). */
  toPublicUser(user: User, needsPhone = false): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      xp: user.xp,
      sparks: user.sparks,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      level: user.level,
      province: user.province,
      district: user.district,
      phone: user.phoneVerifiedAt ? user.phone : null,
      phoneVerified: user.phoneVerifiedAt !== null,
      needsPhone,
    };
  }
}

function phoneTaken() {
  return phoneError(HttpStatus.CONFLICT, 'PHONE_TAKEN', 'Энэ дугаар өөр дансанд бүртгэлтэй байна.');
}

function phoneNotFound() {
  return phoneError(HttpStatus.NOT_FOUND, 'PHONE_NOT_FOUND', 'Энэ дугаараар бүртгэл олдсонгүй.');
}

/** Postgres 23505 on the verified-phone index → PHONE_TAKEN; anything else unchanged. */
function mapUniqueViolation(err: unknown): unknown {
  const e = err as { code?: string; detail?: string };
  if (e.code === '23505' && (e.detail ?? '').includes('phone')) return phoneTaken();
  return err;
}
