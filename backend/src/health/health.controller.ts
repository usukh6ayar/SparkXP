import { Controller, Get, Inject } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { REDIS_CLIENT } from '../redis/redis.module';
import type Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get()
  async check() {
    const [dbOk, redisOk] = await Promise.all([
      this.db.query('SELECT 1').then(() => true).catch(() => false),
      this.pingRedis(),
    ]);

    const status = dbOk && redisOk ? 'ok' : 'degraded';
    return {
      status,
      db: dbOk ? 'ok' : 'error',
      redis: redisOk ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Ping Redis with a hard timeout. ioredis is configured with
   * maxRetriesPerRequest:null, so a command issued while disconnected queues
   * forever and never rejects — which would hang the health check (and fail
   * the deploy healthcheck). Racing a timeout guarantees a response.
   */
  private async pingRedis(): Promise<boolean> {
    try {
      const pong = await Promise.race([
        this.redis.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('redis ping timeout')), 2000),
        ),
      ]);
      return pong === 'PONG';
    } catch {
      return false;
    }
  }
}
