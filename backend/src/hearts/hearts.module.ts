import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { SparksModule } from '../sparks/sparks.module';
import { HeartsService } from './hearts.service';
import { HeartsController } from './hearts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User]), SparksModule],
  providers: [HeartsService],
  controllers: [HeartsController],
  exports: [HeartsService], // QuizzesModule spends hearts inside /check
})
export class HeartsModule {}
