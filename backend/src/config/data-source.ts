import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';
import { entities } from '../entities';

// Standalone DataSource for the TypeORM CLI (migrations). The Nest app uses
// buildTypeOrmOptions via AppModule; this mirrors it for command-line tooling.
loadEnv();

const ssl =
  process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false;

// Use DATABASE_URL when present (Railway/cloud), else individual DB_* vars.
export default new DataSource(
  process.env.DATABASE_URL
    ? {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities,
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
        ssl,
      }
    : {
        type: 'postgres',
        host: process.env.DB_HOST ?? 'localhost',
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME ?? 'postgres',
        password: process.env.DB_PASSWORD ?? 'postgres',
        database: process.env.DB_NAME ?? 'englishxp',
        entities,
        migrations: ['src/migrations/*.ts'],
        synchronize: false,
        ssl,
      },
);
