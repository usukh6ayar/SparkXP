import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XpLog } from '../entities/xp-log.entity';
import { XpService } from './xp.service';

@Module({
  imports: [TypeOrmModule.forFeature([XpLog])],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}
