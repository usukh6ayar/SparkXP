import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { Plan } from '../entities/plan.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { User } from '../entities/user.entity';
import { ReferralsModule } from '../referrals/referrals.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentsEnabledGuard } from './guards/payments-enabled.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Plan, SparksLog, User]), ReferralsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsEnabledGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}
