import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Redis } from 'ioredis';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { User } from '../entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './strategies/jwt.strategy';

/** Cost factor for bcrypt. 10 is a good default for an MVP. */
const BCRYPT_ROUNDS = 10;
/** OTP codes live for 10 minutes. */
const OTP_TTL_SECONDS = 600;

/** What the API returns on successful login / verify. */
export interface AuthResult {
  accessToken: string;
  user: PublicUser;
}

/** User fields safe to send to the client (never the password hash). */
export interface PublicUser {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  role: string;
  xp: number;
  sparks: number;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Create a new account (unverified) and email an OTP. No token is returned
   * yet — the user must verify the code via `verifyOtp` to log in.
   */
  async register(dto: RegisterDto): Promise<{ pendingVerification: true; email: string }> {
    if (await this.usersService.findByEmail(dto.email)) {
      throw new ConflictException('Энэ имэйл аль хэдийн бүртгэлтэй байна');
    }
    if (await this.usersService.findByUsername(dto.username)) {
      throw new ConflictException('Энэ username аль хэдийн бүртгэлтэй байна');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create({
      email: dto.email,
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
      emailVerified: false,
      province: dto.province ?? null,
      district: dto.district ?? null,
    });

    await this.sendOtp('verify', user.email);
    return { pendingVerification: true, email: user.email };
  }

  /** Confirm the email with the OTP, then log the user in. */
  async verifyOtp(email: string, code: string): Promise<AuthResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('Хэрэглэгч олдсонгүй');

    await this.consumeOtp('verify', email, code);
    if (!user.emailVerified) {
      await this.usersService.markEmailVerified(user.id);
      user.emailVerified = true;
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
    const user = await this.usersService.findByUsernameOrEmail(dto.identifier.trim());
    // Same error whether the identifier or password is wrong — don't leak which.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Нэвтрэх нэр эсвэл нууц үг буруу байна');
    }
    return this.buildAuthResult(user);
  }

  /** Start password recovery: email a reset code. Always "ok" (no user leak). */
  async forgotPassword(email: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(email);
    if (user) await this.sendOtp('reset', email);
    return { ok: true };
  }

  /** Finish password recovery: validate the code and set a new password. */
  async resetPassword(email: string, code: string, password: string): Promise<{ ok: true }> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('Хэрэглэгч олдсонгүй');

    await this.consumeOtp('reset', email, code);
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.usersService.setPasswordHash(user.id, passwordHash);
    return { ok: true };
  }

  // ── OTP helpers ─────────────────────────────────────────────────────────

  private otpKey(purpose: 'verify' | 'reset', email: string): string {
    return `otp:${purpose}:${email.toLowerCase()}`;
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

  private buildAuthResult(user: User): AuthResult {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  /** Maps a User entity to the public shape (drops passwordHash, relations). */
  toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      xp: user.xp,
      sparks: user.sparks,
      emailVerified: user.emailVerified,
    };
  }
}
