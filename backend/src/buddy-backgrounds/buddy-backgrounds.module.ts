import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuddyBackground } from '../entities/buddy-background.entity';
import { UserBuddyBackground } from '../entities/user-buddy-background.entity';
import { User } from '../entities/user.entity';
import { SparksModule } from '../sparks/sparks.module';
import { BuddyBackgroundsService } from './buddy-backgrounds.service';
import { BuddyBackgroundsController } from './buddy-backgrounds.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([BuddyBackground, UserBuddyBackground, User]),
    SparksModule,
  ],
  providers: [BuddyBackgroundsService],
  controllers: [BuddyBackgroundsController],
  exports: [BuddyBackgroundsService],
})
export class BuddyBackgroundsModule {}
