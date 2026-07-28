import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { Lesson } from '../entities/lesson.entity';
import { XpService } from './xp.service';
import { XpController } from './xp.controller';
import { SparksModule } from '../sparks/sparks.module';

@Module({
  imports: [TypeOrmModule.forFeature([XpLog, User, Lesson]), SparksModule],
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
