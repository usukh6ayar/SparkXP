import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from '../entities/plan.entity';
import { PromoCode } from '../entities/promo-code.entity';
import { PromoRedemption } from '../entities/promo-redemption.entity';
import { User } from '../entities/user.entity';
import { AdminPromosController, PromosController } from './promos.controller';
import { PromosService } from './promos.service';

/** Promo codes + influencer trial access (tasks #5, #6). */
@Module({
  imports: [TypeOrmModule.forFeature([PromoCode, PromoRedemption, Plan, User])],
  controllers: [PromosController, AdminPromosController],
  providers: [PromosService],
  exports: [PromosService],
})
export class PromosModule {}
