import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { User } from '../entities/user.entity';
import { ReferralsModule } from '../referrals/referrals.module';
import { PromosModule } from '../promos/promos.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';
import { BylClient } from './byl/byl.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, Plan, SparksLog, User]),
    ReferralsModule,
    PromosModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsEnabledGuard, BylClient],
  exports: [PaymentsService],
})
export class PaymentsModule {}
