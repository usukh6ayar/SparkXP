import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { XpLog } from '../entities/xp-log.entity';
import { SparksLog } from '../entities/sparks-log.entity';
import { XpModule } from '../xp/xp.module';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';

/**
 * Referral (invite) feature. Injects XpService to award signup XP; the
 * first-purchase Sparks bonus is credited inside the payment transaction via
 * `creditFirstPurchaseBonus`. Exports the service so Auth + Payments can use it.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User, XpLog, SparksLog]), XpModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
