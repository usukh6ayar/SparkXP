# EnglishXP — Backend

NestJS + TypeScript API for EnglishXP. PostgreSQL via TypeORM, Redis for
cache/queue. This is the **foundation only** — entities and infrastructure
wiring, no feature endpoints yet.

## Prerequisites

- Node 18+
- PostgreSQL running locally (or reachable)
- Redis running locally (or reachable)

## Setup

```bash
cp .env.example .env      # then edit credentials
npm install
npm run start:dev         # watch mode on http://localhost:3000/api
```

With `DB_SYNCHRONIZE=true` (dev default), TypeORM auto-creates all tables from
the entities on boot — no manual SQL needed. **Turn this off in production** and
use migrations instead.

## Project layout

```
src/
  main.ts                 App entry: validation pipe, /api prefix, listen
  app.module.ts           Root module: Config + TypeORM + Redis
  config/
    typeorm.config.ts     Builds TypeORM options from env (used by AppModule)
    data-source.ts        Standalone DataSource for the TypeORM CLI (migrations)
  redis/
    redis.module.ts       Global shared ioredis client (token: REDIS_CLIENT)
  common/
    entities/base.entity.ts   UUID id + created_at/updated_at — every entity extends this
    enums/index.ts            Shared enums (roles, types, statuses)
  entities/
    index.ts              Barrel + `entities` array fed to TypeORM
    organization.entity.ts
    user.entity.ts
    class.entity.ts
    lesson.entity.ts
    word.entity.ts
    quiz.entity.ts
    assignment.entity.ts
    word-review.entity.ts
    xp-log.entity.ts
    ai-usage.entity.ts
    message.entity.ts
    payment.entity.ts
```

## Conventions enforced here (from CLAUDE.md)

- **UUID primary keys** everywhere (`BaseEntity`).
- **`created_at` / `updated_at`** on every table (`BaseEntity`).
- **jsonb** for flexible content: `lesson.content`, `quiz.questions`, plus
  `*.metadata` and `organization.settings`.
- Learning content lives in the **database**, never hardcoded.

## Migrations (for production)

```bash
npm run migration:generate -- src/migrations/InitSchema
npm run migration:run
```

## Inspecting the database

Connect with `psql`:

```bash
PGPASSWORD=postgres psql -h localhost -U postgres -d englishxp
```

Useful commands once connected:

```text
\dt            list all tables
\d users       show a table's structure (columns, types)
\d+ words      detailed structure
SELECT * FROM users;   view rows
\q             quit
```

Or use a GUI (TablePlus / DBeaver) with: host `localhost`, port `5432`,
database `englishxp`, user `postgres`, password `postgres`.
