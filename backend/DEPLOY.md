# Backend Deploy Guide

NestJS API for EnglishXP / SparkXP. Stateless container + managed Postgres +
managed Redis. Works on Railway, Render, Fly.io, or any Docker host.

## 1. Provision services

- **PostgreSQL** — Neon / Supabase / Railway. Copy the connection details.
- **Redis** — Upstash (use `REDIS_URL`) or Railway Redis.
- **Email** — a Resend account (`RESEND_API_KEY`) *or* any SMTP provider.
- **Media (optional but recommended)** — a Cloudinary account so uploaded /
  AI-generated images survive container restarts. Without it, files fall back to
  the local `uploads/` dir, which is **ephemeral** on most hosts.

## 2. Environment variables

Copy `.env.example` → set real values. Production must change:

| Var | Notes |
|-----|-------|
| `NODE_ENV` | `production` |
| `DB_HOST/PORT/USERNAME/PASSWORD/NAME` | from managed Postgres |
| `DB_SSL` | `true` for Neon/Supabase |
| `DB_SYNCHRONIZE` | **`true` for the first deploy only** (creates schema), then set to `false` — see §4 |
| `REDIS_URL` | from Upstash (or `REDIS_HOST`/`PORT`/`PASSWORD`) |
| `JWT_SECRET` | **must change** from `change-me-in-production` (use a long random string) |
| `ANTHROPIC_API_KEY` | valid key — AI fill / bulk / dictionary need it |
| `OPENAI_API_KEY` | for image generation |
| `RESEND_API_KEY` *or* `SMTP_*` | email; without it OTP codes are only logged |
| `MAIL_FROM` | verified sender domain in prod |
| `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` | persistent media storage |
| `PUBLIC_UPLOAD_BASE_URL` | public base URL of this API, e.g. `https://api.sparkxp.mn` (used in local-fallback URLs) |
| `ADMIN_ORIGIN` | deployed admin URL for CORS, e.g. `https://sparkxp-admin.vercel.app` |

## 3. Build & run (Docker)

```bash
docker build -t englishxp-api ./backend
docker run --env-file backend/.env -p 3000:3000 englishxp-api
```

Health check: `GET /api` (NestApplication logs "API running on ...").

On Railway/Render: point the service at `/backend`, it auto-detects the
`Dockerfile`. Start command is the image `CMD` (`node dist/main`). Without
Docker, run `npm ci && npm run build && npm run start:prod`.

## 4. Database schema (synchronize vs migrations)

This project uses TypeORM `synchronize`, gated by `DB_SYNCHRONIZE`.

**Recommended first-deploy flow (MVP):**
1. First boot: `DB_SYNCHRONIZE=true` → TypeORM creates all tables from entities.
2. Then set `DB_SYNCHRONIZE=false` and redeploy. The schema is now frozen;
   `synchronize` never runs in normal operation (so it can't drop/alter columns).
3. Seed the admin user: `npm run seed` (creates `admin@englishxp.mn`).

**For later schema changes (after launch), use migrations instead of synchronize:**
```bash
# against the live DB, generate a migration from entity changes
npm run migration:generate -- src/migrations/<Name>
npm run migration:run        # apply it
```
Never leave `DB_SYNCHRONIZE=true` permanently in prod — an entity edit could
silently alter the production schema.

## 5. Post-deploy checklist

- [ ] `GET /api` responds (service up)
- [ ] `POST /api/auth/login` with seeded admin works
- [ ] `POST /api/upload` returns a URL that loads (Cloudinary or local)
- [ ] OTP email actually arrives (or is logged if email intentionally stubbed)
- [ ] Admin panel (`ADMIN_ORIGIN`) can call the API without CORS errors
- [ ] `DB_SYNCHRONIZE=false` after first successful boot
- [ ] `JWT_SECRET` is a strong random value
