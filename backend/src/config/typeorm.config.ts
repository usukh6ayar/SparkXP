import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import { entities } from '../entities';

/**
 * Builds TypeORM options from environment config. Shared by the Nest module
 * (AppModule) and the standalone CLI data source so both stay in sync.
 *
 * Schema strategy:
 *   - Dev:  DB_SYNCHRONIZE=true auto-creates the schema from entities.
 *   - Prod: DB_SYNCHRONIZE=false + DB_MIGRATIONS_RUN=true runs the SQL
 *           migrations in src/migrations on boot. Never enable synchronize in
 *           production — it can drop/alter columns and lose data.
 *
 * Connection pool:
 *   node-postgres defaults to `min: 0` + `idleTimeoutMillis: 10000`, so on a
 *   low-traffic API every connection is closed 10s after it goes idle and the
 *   next request pays a full reconnect (DNS + TCP + TLS + SCRAM auth). Measured
 *   on Railway prod 2026-07-29 that was ~170ms of dead time on EVERY query.
 *   Keeping a few warm connections removes it. See docs/INFRA_COST_MODEL.md §12.
 */
export function buildTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  // Cloud hosts (Railway, Neon, Render) expose ONE connection string. When
  // DATABASE_URL is present we connect with it; otherwise fall back to the
  // individual DB_* vars (local dev).
  const databaseUrl = config.get<string>('DATABASE_URL');

  const base = {
    type: 'postgres' as const,
    entities,
    // Compiled .js at runtime (dist/), .ts when run via ts-node.
    migrations: [join(__dirname, '..', 'migrations', '*.{js,ts}')],
    synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
    // Auto-run pending migrations on boot (use in prod instead of synchronize).
    migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true',
    logging: config.get<string>('DB_LOGGING') === 'true',
    // Neon / Supabase / cloud PostgreSQL requires SSL
    ssl: config.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
    // Passed straight through to the node-postgres Pool.
    extra: {
      // Per instance. Postgres allows ~100 total, so stay well under it once
      // several replicas connect: 20 x 3 replicas = 60.
      max: config.get<number>('DB_POOL_MAX', 20),
      // Warm connections that are never closed for being idle. This is the fix
      // for the reconnect-per-request problem described above.
      min: config.get<number>('DB_POOL_MIN', 2),
      // 10 minutes instead of the 10s default — connections above `min` survive
      // normal traffic gaps instead of churning.
      idleTimeoutMillis: 600_000,
      // Fail fast instead of hanging a request when the pool is exhausted.
      connectionTimeoutMillis: 5_000,
      // Stop idle TCP sockets being dropped silently by the network in between.
      keepAlive: true,
    },
  };

  if (databaseUrl) {
    return { ...base, url: databaseUrl };
  }

  return {
    ...base,
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USERNAME', 'postgres'),
    password: config.get<string>('DB_PASSWORD', 'postgres'),
    database: config.get<string>('DB_NAME', 'englishxp'),
  };
}
