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
