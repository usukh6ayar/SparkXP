import { Global, Logger, Module } from '@nestjs/common';
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
        const logger = new Logger('Redis');
        const url = config.get<string>('REDIS_URL');
        // family: 0 = allow IPv4 AND IPv6 DNS lookups. Required on Railway,
        // whose private network (*.railway.internal) is IPv6-only — without it
        // ioredis defaults to IPv4 and can't resolve the Redis host.
        // commandTimeout: fail a command after 10s instead of hanging forever
        // when Redis is unreachable — otherwise requests never respond and the
        // client gives up (HTTP 499). Lets callers catch + fall back gracefully.
        const client = url
          ? new Redis(url, {
              maxRetriesPerRequest: null,
              commandTimeout: 10_000,
              family: 0,
              tls: url.startsWith('rediss://') ? {} : undefined,
            })
          : new Redis({
              host: config.get<string>('REDIS_HOST', 'localhost'),
              port: config.get<number>('REDIS_PORT', 6379),
              password: config.get<string>('REDIS_PASSWORD') || undefined,
              maxRetriesPerRequest: null,
              commandTimeout: 10_000,
              family: 0,
            });
        // Without an 'error' listener ioredis spams "Unhandled error event".
        // Log once-ish instead; the client keeps retrying in the background.
        client.on('error', (err) => logger.warn(`Redis error: ${err.message}`));
        return client;
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
