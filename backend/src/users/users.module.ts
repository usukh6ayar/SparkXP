import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Plan } from '../entities/plan.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  // AiGatewayModule provides ImageStorageService (R2/Cloudinary) for avatars.
  imports: [TypeOrmModule.forFeature([User, Plan]), AiGatewayModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
