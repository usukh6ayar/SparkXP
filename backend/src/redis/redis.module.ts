import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Injection token for the shared Redis client. */
export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Provides a single shared ioredis client app-wide (cache + queue backbone).
 * Marked @Global so features can inject REDIS_CLIENT without re-importing.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        // family: 0 = allow IPv4 AND IPv6 DNS lookups. Required on Railway,
        // whose private network (*.railway.internal) is IPv6-only — without it
        // ioredis defaults to IPv4 and can't resolve the Redis host.
        return url
          ? new Redis(url, {
              maxRetriesPerRequest: null,
              family: 0,
              tls: url.startsWith('rediss://') ? {} : undefined,
            })
          : new Redis({
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
              password: config.get<string>('REDIS_PASSWORD') || undefined,
              maxRetriesPerRequest: null,
              family: 0,
            });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
