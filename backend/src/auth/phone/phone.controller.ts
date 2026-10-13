import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../auth.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../common/enums';
import { UsersService } from '../../users/users.service';
import { PhoneVerificationService } from './phone-verification.service';
import {
  CheckAvailabilityDto,
  PhoneResetDto,
  RegisterPhoneDto,
  StartLinkPhoneDto,
  StartPhoneDto,
  VerificationIdDto,
} from './dto/phone.dto';

/** Each session start makes the user spend 150₮ on an SMS — keep it tight. */
const SESSION_START = { default: { limit: 5, ttl: 60_000 } };
/** Same credential limit as /auth/login. */
const STRICT = { default: { limit: 5, ttl: 60_000 } };
/** The app polls every 3 s for up to 5 min ≈ 100 calls; leave headroom. */
const POLL = { default: { limit: 40, ttl: 60_000 } };

/**
 * Every phone route (spec 2026-10-13). Full paths on purpose: the link/admin
 * routes live under /users but need AuthService, and UsersModule must not
 * import AuthModule back.
 */
@Controller()
export class PhoneController {
  constructor(
    private readonly auth: AuthService,
    private readonly phone: PhoneVerificationService,
    private readonly users: UsersService,
  ) {}

  @Throttle(SESSION_START)
  @Get('auth/check-availability')
  checkAvailability(@Query() q: CheckAvailabilityDto) {
    return this.auth.checkAvailability(q.username, q.phone);
  }

  @Throttle(SESSION_START)
  @Post('auth/phone/start')
  @HttpCode(200)
  start(@Body() dto: StartPhoneDto) {
    return this.auth.startPhone(dto.phone, dto.purpose);
  }

  @Throttle(POLL)
  @Get('auth/phone/status/:verificationId')
  status(@Param('verificationId', ParseUUIDPipe) id: string) {
    return this.phone.status(id);
  }

  @Throttle(STRICT)
  @Post('auth/register-phone')
  registerPhone(@Body() dto: RegisterPhoneDto) {
    return this.auth.registerWithPhone(dto);
  }

  @Throttle(STRICT)
  @Post('auth/phone/login')
  @HttpCode(200)
  login(@Body() dto: VerificationIdDto) {
    return this.auth.loginWithPhone(dto.verificationId);
  }

  @Throttle(STRICT)
  @Post('auth/phone/reset')
  @HttpCode(200)
  reset(@Body() dto: PhoneResetDto) {
    return this.auth.resetWithPhone(dto.verificationId, dto.password);
  }

  @Throttle(SESSION_START)
  @UseGuards(JwtAuthGuard)
  @Post('users/me/phone/start')
  @HttpCode(200)
  startLink(@CurrentUser() user: User, @Body() dto: StartLinkPhoneDto) {
    return this.auth.startLinkPhone(user, dto.phone);
  }

  @UseGuards(JwtAuthGuard)
  @Post('users/me/phone')
  @HttpCode(200)
  link(@CurrentUser() user: User, @Body() dto: VerificationIdDto) {
    return this.auth.linkPhone(user, dto.verificationId);
  }

  /** Admin: release a recycled number. */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Delete('users/:id/phone')
  async unlink(@Param('id', ParseUUIDPipe) id: string) {
    await this.users.clearPhone(id);
    return { ok: true };
  }
}
