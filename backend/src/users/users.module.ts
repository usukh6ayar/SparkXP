import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from './users.service';

/**
 * Owns the User repository and exposes UsersService to other modules
 * (AuthModule imports it). No controller yet — profile/admin endpoints come
 * in a later task (see ROADMAP.md).
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
