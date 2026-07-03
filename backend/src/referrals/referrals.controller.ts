import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { ReferralsService } from './referrals.service';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  /** The logged-in user's referral code + reward stats (for the invite screen). */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMine(@CurrentUser() user: User) {
    return this.service.getMyReferral(user.id);
  }
}
