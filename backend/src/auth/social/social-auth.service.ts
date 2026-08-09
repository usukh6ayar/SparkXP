import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserIdentity } from '../../entities/user-identity.entity';
import { AuthProvider, UserRole } from '../../common/enums';
import { UsersService } from '../../users/users.service';
import { AuthService, type AuthResult } from '../auth.service';
import { SocialTokenService, type SocialProfile } from './social-token.service';
import { USERNAME_RE, USERNAME_MIN, USERNAME_MAX } from '../../common/validation/username';

/** Minutes a half-finished social sign-up may sit on the username screen. */
const SIGNUP_TICKET_TTL = '15m';

/** Marks the ticket as NOT a session token — `JwtStrategy` refuses these. */
const SIGNUP_PURPOSE = 'social_signup';

/** Either "you're in" or "pick a username first". */
export type SocialSignInResult =
  | ({ needsUsername: false } & AuthResult)
  | {
      needsUsername: true;
      /** Opaque, short-lived; hand back to `complete` with the chosen name. */
      ticket: string;
      email: string;
      /** A starting point for the field — the user may replace it entirely. */
      suggestedUsername: string;
      fullName: string | null;
    };

interface SignupTicket {
  purpose: typeof SIGNUP_PURPOSE;
  provider: AuthProvider;
  sub: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
}

/**
 * Google / Apple sign-in.
 *
 * The account rules, in one place because they are the whole security story:
 *
 * 1. **Identity is keyed on (provider, sub)**, never the email. `sub` is stable
 *    and cannot be changed by the user; an email address can be reassigned, and
 *    Apple's relay addresses differ per app.
 * 2. **An existing account is only adopted when the provider says the address
 *    is verified.** Otherwise anyone able to mint a token for an unverified
 *    address could claim someone else's SparkXP account.
 * 3. **A brand-new user picks their own username** (owner's requirement). We
 *    can't invent one: usernames are public on leaderboards, and a derived
 *    handle would leak the person's email local-part. So sign-in pauses and
 *    returns a signed ticket instead of creating a half-formed account.
 * 4. Accounts created this way have **no password** (`passwordHash: null`) and
 *    are email-verified from the start — the provider already did that.
 */
@Injectable()
export class SocialAuthService {
  private readonly logger = new Logger(SocialAuthService.name);

  constructor(
    @InjectRepository(UserIdentity)
    private readonly identities: Repository<UserIdentity>,
    private readonly tokens: SocialTokenService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  /** Which providers the app should actually offer (config-driven). */
  availability(): { google: boolean; apple: boolean } {
    return {
      google: this.tokens.isEnabled(AuthProvider.GOOGLE),
      apple: this.tokens.isEnabled(AuthProvider.APPLE),
    };
  }

  async signIn(provider: AuthProvider, idToken: string): Promise<SocialSignInResult> {
    const profile = await this.tokens.verify(provider, idToken);

    // 1 — known identity: straight in.
    const existing = await this.identities.findOne({
      where: { provider, providerUserId: profile.sub },
    });
    if (existing) {
      const user = await this.usersService.findById(existing.userId);
      if (!user) {
        // Identity outlived its account (shouldn't happen — the FK cascades).
        await this.identities.delete({ id: existing.id });
        throw new UnauthorizedException('Хэрэглэгч олдсонгүй');
      }
      return { needsUsername: false, ...this.authService.buildAuthResult(user) };
    }

    // Apple sends the address on the FIRST authorisation only. That's fine:
    // after it, the identity above exists and we never need the email again.
    if (!profile.email) {
      throw new BadRequestException(
        'Энэ данснаас имэйл хаяг ирсэнгүй. Имэйлээр бүртгүүлнэ үү.',
      );
    }

    // 2 — same verified address as an existing account: link, don't duplicate.
    if (profile.emailVerified) {
      const byEmail = await this.usersService.findByEmail(profile.email);
      if (byEmail) {
        await this.link(byEmail.id, profile);
        // An address the provider vouched for is at least as good as our OTP.
        if (!byEmail.emailVerified) {
          await this.usersService.markEmailVerified(byEmail.id);
          byEmail.emailVerified = true;
        }
        return { needsUsername: false, ...this.authService.buildAuthResult(byEmail) };
      }
    }

    // 3 — new person: pause for a username.
    const ticket: SignupTicket = {
      purpose: SIGNUP_PURPOSE,
      provider,
      sub: profile.sub,
      email: profile.email,
      emailVerified: profile.emailVerified,
      fullName: profile.fullName,
    };
    return {
      needsUsername: true,
      ticket: this.jwtService.sign(ticket, { expiresIn: SIGNUP_TICKET_TTL }),
      email: profile.email,
      suggestedUsername: await this.suggestUsername(profile.email),
      fullName: profile.fullName,
    };
  }

  /** Finish a paused sign-up with the username the user chose. */
  async completeSignUp(ticket: string, username: string, fullName?: string): Promise<AuthResult> {
    let claims: SignupTicket;
    try {
      claims = this.jwtService.verify<SignupTicket>(ticket);
    } catch {
      throw new UnauthorizedException('Хугацаа дууссан байна. Дахин нэвтэрнэ үү.');
    }
    if (claims.purpose !== SIGNUP_PURPOSE) {
      throw new UnauthorizedException('Токен хүчингүй байна');
    }

    // Same rule as `@IsUsername()` on the DTO — checked again here because the
    // handle is what makes the account, and this path can be reached with a
    // ticket from an older app build.
    const handle = username.trim();
    if (
      handle.length < USERNAME_MIN ||
      handle.length > USERNAME_MAX ||
      !USERNAME_RE.test(handle)
    ) {
      throw new BadRequestException(
        `Нэвтрэх нэр ${USERNAME_MIN}–${USERNAME_MAX} тэмдэгт, зөвхөн үсэг, тоо, "_" агуулна`,
      );
    }
    await this.usersService.assertUsernameFree(handle);

    // The token was minted up to 15 minutes ago; someone may have registered
    // that address by email in the meantime. Adopt it rather than 409-ing.
    const existing = await this.usersService.findByEmail(claims.email);
    if (existing) {
      await this.link(existing.id, { ...claims, provider: claims.provider });
      return this.authService.buildAuthResult(existing);
    }

    const user = await this.usersService.create({
      email: claims.email,
      username: handle,
      // No password: this account signs in through the provider. Anything that
      // compares a password must handle null (see AccountDeletionService).
      passwordHash: null,
      fullName: (fullName ?? claims.fullName ?? handle).trim(),
      role: UserRole.STUDENT,
      // The provider already proved the address — no OTP to send or wait for.
      emailVerified: claims.emailVerified,
    });

    await this.link(user.id, claims);
    return this.authService.buildAuthResult(user);
  }

  private async link(
    userId: string,
    profile: Pick<SocialProfile, 'provider' | 'sub' | 'email'>,
  ): Promise<void> {
    try {
      await this.identities.save(
        this.identities.create({
          userId,
          provider: profile.provider,
          providerUserId: profile.sub,
          providerEmail: profile.email,
        }),
      );
    } catch (err) {
      // Unique violation ⇒ two parallel sign-ins raced. Harmless: the identity
      // exists, which is all we wanted.
      const code = (err as { code?: string }).code;
      if (code !== '23505') throw err;
      this.logger.debug(`Identity already linked for ${profile.provider}`);
    }
  }

  /**
   * A free handle derived from the address, offered as a default. Purely a
   * convenience — the screen lets the user type anything, and this never
   * becomes the username on its own.
   */
  private async suggestUsername(email: string): Promise<string> {
    const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
    const seed = base.length >= 3 ? base : `user${base}`;
    for (let i = 0; i < 20; i++) {
      const candidate = i === 0 ? seed : `${seed}${i}`;
      try {
        await this.usersService.assertUsernameFree(candidate);
        return candidate;
      } catch (err) {
        if (!(err instanceof ConflictException)) throw err;
      }
    }
    return `${seed}${Date.now().toString().slice(-4)}`;
  }
}
