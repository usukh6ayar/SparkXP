import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  ConflictException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreatePlanDto } from './dto/create-plan.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /** Create a payment intent (QPay QR stub). Requires login. */
  @Post()
  @UseGuards(JwtAuthGuard)
  createIntent(@Body() dto: CreatePaymentDto, @CurrentUser() user: User) {
    return this.service.createIntent(dto, user);
  }

  /** Confirm payment after QPay callback. Requires login. */
  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPaymentDto,
    @CurrentUser() user: User,
  ) {
    return this.service.confirm(id, dto, user);
  }

  /** User's own payment history. Requires login. */
  @Get('my')
  @UseGuards(JwtAuthGuard)
  findMy(@CurrentUser() user: User) {
    return this.service.findMy(user);
  }

  /** Admin: all payments with user info. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  findAll() {
    return this.service.findAll();
  }

  /** Public: list all active subscription plans (mobile app uses this). */
  @Get('plans')
  findPlans() {
    return this.service.findAllPlans();
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
}
