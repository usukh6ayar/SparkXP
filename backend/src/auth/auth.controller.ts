import { Controller, Post, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto, EmailOnlyDto, ResetPasswordDto } from './dto/otp.dto';
import { SocialSignInDto, SocialCompleteDto } from './dto/social.dto';
import { SocialAuthService } from './social/social-auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Throttle } from '@nestjs/throttler';

/**
 * Strict per-IP limits for the credential/OTP surface. These endpoints were
 * previously unlimited, which made password brute-forcing and guessing a
 * 6-digit OTP (1,000,000 possibilities) purely a matter of time. The global
 * 120/min baseline in AppModule is far too loose for them.
 */
const STRICT = { default: { limit: 5, ttl: 60_000 } };   // credentials
const EMAIL_SEND = { default: { limit: 3, ttl: 300_000 } }; // outbound email

/** Auth endpoints under /api/auth. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly social: SocialAuthService,
  ) {}

  /** Create an account (unverified) and email an OTP. No token yet. */
  @Throttle(EMAIL_SEND)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** Confirm the email with the OTP → returns a token (logs in). */
  @Throttle(STRICT)
  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  /** Re-send the verification OTP. */
  @Throttle(EMAIL_SEND)
  @Post('resend-otp')
  @HttpCode(200)
  resendOtp(@Body() dto: EmailOnlyDto) {
    return this.authService.resendOtp(dto.email);
  }

  /** Log in with username (or email) + password, return a token. */
  @Throttle(STRICT)
  @Post('login')
  @HttpCode(200) // login isn't "creating" a resource, so 200 not 201
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Start password recovery — email a reset code. */
  @Throttle(EMAIL_SEND)
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: EmailOnlyDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /** Finish password recovery — set a new password with the emailed code. */
  @Throttle(STRICT)
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.password);
  }

  // ── Google / Apple ────────────────────────────────────────────────────────

  /**
   * Which social buttons the app should show.
   *
   * Driven by whether the client ids are configured, so a provider can be
   * switched on without shipping an app update — and the app never offers a
   * button that is certain to fail.
   */
  @Get('social/providers')
  socialProviders() {
    return this.social.availability();
  }

  /**
   * Sign in with a Google/Apple identity token.
   *
   * Returns either a normal session, or `{ needsUsername: true, ticket }` when
   * this is a new person — SparkXP usernames are public on leaderboards, so the
   * user picks their own instead of us deriving one from their email.
   *
   * STRICT-throttled with the other credential routes: it mints sessions.
   */
  @Throttle(STRICT)
  @Post('social')
  @HttpCode(200)
  socialSignIn(@Body() dto: SocialSignInDto) {
    return this.social.signIn(dto.provider, dto.idToken);
  }

  /** Finish a paused social sign-up with the chosen username. */
  @Throttle(STRICT)
  @Post('social/complete')
  @HttpCode(200)
  socialComplete(@Body() dto: SocialCompleteDto) {
    return this.social.completeSignUp(dto.ticket, dto.username, dto.fullName);
  }

  /** Return the current user. Requires a valid Bearer token. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.toPublicUser(user);
  }
}
