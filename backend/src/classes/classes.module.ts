import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassEntity } from '../entities/class.entity';
import { User } from '../entities/user.entity';
import { ClassesService } from './classes.service';
import { ClassesController } from './classes.controller';

/** Teacher classes + student enrollment (join codes). Exports the service so
 *  the Assignments module can verify class ownership. */
@Module({
  imports: [TypeOrmModule.forFeature([ClassEntity, User])],
  controllers: [ClassesController],
  providers: [ClassesService],
  exports: [ClassesService],
})
export class ClassesModule {}
