import {
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Price + promo + resulting expiry, before paying (website checkout page). */
  @Get('quote')
  @UseGuards(JwtAuthGuard)
  async quote(@Query() dto: CreatePaymentDto, @CurrentUser() user: User) {
    const { plan: _plan, ...q } = await this.service.quote(user, dto);
    return q;
  }

  /** Pending payment + Byl checkout → { paymentId, checkoutUrl }. Grants nothing. */
  @Post()
  @UseGuards(JwtAuthGuard, PaymentsEnabledGuard)
  createCheckout(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.service.createCheckout(user, dto);
  }

  /**
   * Byl → us. Signature-verified; the ONLY route that grants a purchase.
   * Public by design (Byl has no JWT); never throttled — Byl retries must land.
   */
  @Post('webhook/byl')
  @HttpCode(200)
  @SkipThrottle()
  async bylWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('byl-signature') signature?: string,
  ) {
    await this.service.handleBylWebhook(req.rawBody, signature);
    return { ok: true };
  }

  /** User's own payment history. Requires login. */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@CurrentUser() user: User) {
    return this.service.findMy(user);
  }

  /** Public: list all active subscription plans (mobile app + website). */
  @Get('plans')
  findPlans() {
    return this.service.findAllPlans();
  }

  /** Admin: CSV for the accountant (manual e-barimt). */
  @Get('export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="sparkxp-payments.csv"')
  exportCsv() {
    return this.service.exportCsv();
  }

  /** Admin: all payments with user info. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.service.findAll();
  }

  /** Admin: create a new subscription plan. */
  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createPlan(@Body() dto: CreatePlanDto) {
    try {
      return await this.service.createPlan(dto);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message ?? '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        throw new ConflictException(`"${dto.slug}" slug аль хэдийн байна`);
      }
      throw e;
    }
  }

  @Patch('plans/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.service.updatePlan(id, dto);
  }

  /**
   * The buyer's own payment — the website success page polls this. Declared
   * LAST: `:id` would otherwise swallow the static paths above.
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.service.findOne(user, id);
  }
}
