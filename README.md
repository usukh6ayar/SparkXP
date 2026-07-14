# SparkXP

Gamified **English learning** app for Mongolian students, schools, and organizations.  
Owner: **Hustle Hive LLC**.

| | |
|---|---|
| **Mobile** | React Native + Expo (`/mobile`) |
| **API** | NestJS + PostgreSQL + Redis (`/backend`) |
| **Admin** | Vite + React (`/admin`) |
| **Prod API** | https://sparkxp-production.up.railway.app/api |
| **Admin web** | https://spark-xp.vercel.app |
| **Repo** | https://github.com/usukh6ayar/SparkXP |

---

## Features (MVP)

- Auth (username/email, JWT, roles)
- Lessons, reading, quizzes, vocabulary (SRS)
- Gamification: XP, Sparks, streaks, leaderboard
- AI Buddy — text + voice practice (STT/TTS via AI Gateway)
- Teacher: classes, join codes, assignments
- Admin: content, words AI pipeline, buddies, limits

---

## Repo layout

```
SparkXP/
├── mobile/          # Expo student + teacher app
├── backend/         # NestJS API (Railway)
├── admin/           # Content / ops dashboard (Vercel)
├── docs/            # Plans, Hot Updater, AI Buddy, etc.
├── API.md           # Endpoint reference
├── ROADMAP.md       # Who does what + launch checklist
├── CODING_RULES.md  # Enforced coding standard
└── CLAUDE.md        # Shared AI-dev project brain
```

---

## Quick start

### Backend

```bash
cd backend
cp .env.example .env    # set DB, Redis, JWT, AI keys
npm install
npm run start:dev       # http://localhost:3000/api
```

Needs local **PostgreSQL** + **Redis** (see `CLAUDE.md`).

### Mobile

```bash
cd mobile
cp .env.example .env    # EXPO_PUBLIC_API_URL → your Mac LAN IP or prod
npm install
npm start
```

### Admin

```bash
cd admin
cp .env.example .env    # API base URL
npm install
npm run dev
```

---

## Team (3 devs)

| Dev | Owns | Branch |
|---|---|---|
| **Өсөхбаяр** | Backend + Admin | `usukhbayar` / feature branches |
| **Choi** | Mobile — learning core | `choi` |
| **Boju** | Mobile — games / AI chat / social | `boju` |

- Never push straight to `main` — **PR + review**
- Always `git pull origin main` before starting work
- Full rules: `CLAUDE.md` · coding: `CODING_RULES.md`

---

## Hot Updater (OTA)

JS/UI fixes without App Store review.

```bash
cd mobile
npm run ota:deploy    # after native build is installed on device
```

**Full guide (MN):** [`docs/HOT_UPDATER.md`](docs/HOT_UPDATER.md)

| Works with OTA? | Needs new App Store build? |
|---|---|
| UI, JS bugs, copy, most assets in bundle | Native modules, permissions, SDK upgrade |
| **3D GLB from CDN URL** (admin `avatarAssetUrl`) | First time adding 3D **native libs** (already in app) |

---

## Deploy overview

| Layer | Host |
|---|---|
| API | Railway |
| DB | Railway Postgres (or Neon later) |
| Media / OTA bundles | Cloudflare R2 |
| Admin | Vercel |
| iOS / Android binaries | EAS Build → App Store / Play |

---

## Docs index

| Doc | Topic |
|---|---|
| [`ROADMAP.md`](ROADMAP.md) | Tasks, launch, ownership |
| [`API.md`](API.md) | All API endpoints |
| [`docs/FUTURE_PLAN.md`](docs/FUTURE_PLAN.md) | Product + pricing + AI cost |
| [`docs/HOT_UPDATER.md`](docs/HOT_UPDATER.md) | OTA deploy guide |
| [`docs/AI_BUDDY_PLAN.md`](docs/AI_BUDDY_PLAN.md) | AI Buddy pipeline |
| [`docs/AI_BUDDY_AVATAR_MESHY.md`](docs/AI_BUDDY_AVATAR_MESHY.md) | 3D avatar (Meshy → GLB) |
| [`CODING_RULES.md`](CODING_RULES.md) | Code standards |

---

## License

Private — Hustle Hive LLC. All rights reserved.
