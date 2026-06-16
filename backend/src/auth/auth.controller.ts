import { Controller, Post, Get, Body, UseGuards, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto, EmailOnlyDto, ResetPasswordDto } from './dto/otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '../entities/user.entity';

/** Auth endpoints under /api/auth. */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Create an account (unverified) and email an OTP. No token yet. */
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /** Confirm the email with the OTP → returns a token (logs in). */
  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.code);
  }

  /** Re-send the verification OTP. */
  @Post('resend-otp')
  @HttpCode(200)
  resendOtp(@Body() dto: EmailOnlyDto) {
    return this.authService.resendOtp(dto.email);
  }

  /** Log in with username (or email) + password, return a token. */
  @Post('login')
  @HttpCode(200) // login isn't "creating" a resource, so 200 not 201
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** Start password recovery — email a reset code. */
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() dto: EmailOnlyDto) {
    return this.authService.forgotPassword(dto.email);
  }

  /** Finish password recovery — set a new password with the emailed code. */
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.code, dto.password);
  }

  /** Return the current user. Requires a valid Bearer token. */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: User) {
    return this.authService.toPublicUser(user);
  }
}
