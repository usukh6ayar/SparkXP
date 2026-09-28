import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import {
  CreatePromoDto,
  GrantInfluencerDto,
  QuotePromoDto,
  RedeemPromoDto,
  UpdatePromoDto,
} from './dto/promo.dto';
import { PromosService } from './promos.service';

/** The app side: type a code, get access (or a price). */
@Controller('promos')
@UseGuards(JwtAuthGuard)
export class PromosController {
  constructor(private readonly service: PromosService) {}

  /** Redeem a free-access code. Throttled so codes can't be brute-forced. */
  @Post('redeem')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  redeem(@CurrentUser() user: User, @Body() dto: RedeemPromoDto) {
    return this.service.redeem(user.id, dto.code);
  }

  /** Price preview for a discount code at checkout. */
  @Post('quote')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  quote(@CurrentUser() user: User, @Body() dto: QuotePromoDto) {
    return this.service.quote(user.id, dto.code, dto.planId);
  }
}

/** Admin panel «Промо» page. */
@Controller('admin/promos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminPromosController {
  constructor(private readonly service: PromosService) {}

  @Get()
  list(@Query('audience') audience?: string) {
    return this.service.list(audience);
  }

  @Post()
  create(@Body() dto: CreatePromoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromoDto) {
    return this.service.update(id, dto);
  }

  @Get(':id/redemptions')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.history(id);
  }

  /** Influencer 7-day access — by code, or straight onto an account. */
  @Post('influencer')
  grantInfluencer(@Body() dto: GrantInfluencerDto) {
    return this.service.grantInfluencer(dto);
  }
}
