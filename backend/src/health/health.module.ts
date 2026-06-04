import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Health-check endpoint. Redis client comes from the global RedisModule. */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
