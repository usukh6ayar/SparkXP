import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { User } from '../entities/user.entity';
import { XpService } from './xp.service';
import { XpController } from './xp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([XpLog, User])],
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
