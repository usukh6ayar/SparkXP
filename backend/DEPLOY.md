# Deploying the EnglishXP backend

This is the production checklist for the NestJS API (`/backend`). It covers the
three things that block real users: **database schema**, **email**, and **media
uploads** — plus how to run it in Docker.

> Dev setup (local Postgres/Redis) lives in the root `CLAUDE.md`. This file is
> only about going live.

---

## 1. Database schema (migrations, not synchronize)

In dev we use `DB_SYNCHRONIZE=true` to auto-create tables from the entities.
**Never do that in production** — synchronize can drop or alter columns and lose
data. Production uses SQL migrations in `src/migrations/`.

Set these in production:

```env
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=true   # run pending migrations automatically on boot
DB_SSL=true              # required by Neon / Supabase / most cloud Postgres
```

With `DB_MIGRATIONS_RUN=true` the app applies any pending migrations every time
it starts, so a normal deploy = run the container. If you prefer to run them
manually instead, leave it `false` and run:

```bash
npm run migration:run      # apply
npm run migration:revert   # undo the last one
```

**When you change an entity**, generate a new migration (needs a DB to diff
against) and commit it:

```bash
npm run migration:generate -- src/migrations/DescribeYourChange
```

The first migration (`InitialSchema`) creates the whole schema including the
`uuid-ossp` extension, so a brand-new empty database is enough.

---

## 2. Email (OTP verify + password reset)

`MailService` auto-selects a provider from env (no code change needed):

1. `RESEND_API_KEY` set  → [Resend](https://resend.com) HTTP API (simplest)
2. else `SMTP_HOST` set  → any SMTP server (Gmail, Mailgun, SES, …)
3. else                  → dev **stub** that just logs the code (no email sent)

If neither is configured, registration "works" but the code only appears in the
server logs — so **set one before launch**.

```env
# Option A — Resend
RESEND_API_KEY=re_xxx
MAIL_FROM=SparkXP <noreply@yourdomain.mn>   # must be a verified sender

# Option B — SMTP
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=SparkXP <noreply@yourdomain.mn>
```

---

## 3. Media uploads (images / audio / video)

`POST /api/upload` and AI-generated word images both go through
`ImageStorageService`, which picks a target automatically:

- **Cloudinary** when `CLOUDINARY_*` is set → files are persistent + on a CDN.
- **Local `uploads/` folder** otherwise → dev only. On most cloud hosts the
  filesystem is ephemeral, so local-stored files vanish on redeploy.

For production set Cloudinary:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 4. Other required env

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<long-random-string>     # CHANGE from the default
ADMIN_ORIGIN=https://your-admin.vercel.app   # CORS allow-list for the admin web
# Redis: REDIS_HOST/REDIS_PORT, or REDIS_URL for Upstash
```

See `.env.example` for the full annotated list.

---

## 5. Run with Docker

The `Dockerfile` is a 2-stage build (compile, then a slim prod image).

```bash
# from /backend
docker build -t englishxp-api .

docker run -p 3000:3000 --env-file .env englishxp-api
```

The container runs `node dist/main.js`. With `DB_MIGRATIONS_RUN=true` it migrates
on startup, then serves on `:3000` (`/api` prefix). Health check: `GET /api/health`.

### Platform notes (Render / Railway / Fly / etc.)
- Point the service at `/backend` with this Dockerfile, or use a Node build with
  build = `npm ci && npm run build` and start = `npm run start:prod`.
- Provision managed Postgres + Redis and set the env vars above.
- Set `DB_SSL=true` for managed Postgres.
