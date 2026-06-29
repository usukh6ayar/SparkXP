# EnglishXP

Gamified English learning app for Mongolian students, schools, and
organizations (e.g. law firms). Owner: Hustle Hive LLC.

> **This file is the shared brain for both developers' Claude sessions.**
> We are 2 devs, each on a separate Claude Pro account. Keep this file clear and
> up to date — whatever is written here is what each person's Claude will follow.
> For the task list / what to build next, see **ROADMAP.md**.

---

## Team & Working Style

- 2 developers, each using their own Claude Pro account.
- Keep code simple, readable, well-documented. MVP first, scale later.
- Avoid over-engineering. Write code a junior dev can read.

### Work division (who owns what — avoid duplicate work!)

**4 developers (2026-06-29 reorg).** Usukhbayar leads.

- **Usukhbayar** → **Admin web** (`/admin`) + team lead. Branch: `usukhbayar`.
- **Bishrelt** → **Backend** (`/backend`) — builds & maintains endpoints for both
  mobile and admin, updates `API.md`. Branch: `bishrelt`.
- **Choi** → **Mobile** (`/mobile`) learning core: Auth, Home, Lessons (list+detail),
  Review (SRS), Swipe + Saved. Branch: `choi`.
- **Boju** → **Mobile** (`/mobile`) games & social: Quiz, Soril, AI chat,
  Leaderboard, Profile/Avatar/Assignments, Teacher, Join. Branch: `boju`.

The **backend (`/backend`) is shared but Bishrelt-led** — mobile devs request an
endpoint, Bishrelt builds it and updates `API.md`. Don't both build the same
module. The mobile split (Choi vs Boju) is by screen group to avoid conflicts;
shared `mobile/src/components` + `theme.ts` edits go in small PRs, announced here.

## Tech Stack

- Mobile: React Native + Expo
- Backend: NestJS (TypeScript)
- Database: PostgreSQL + TypeORM
- Cache/Queue: Redis (ioredis)
- Auth: JWT
- Storage: Cloud storage + CDN for audio/images

## Repo Structure

- `/backend` — NestJS API (built — see "Current Status")
- `/mobile` — React Native (Expo) app (started — Expo Router, see MOBILE_ROADMAP.md)
- `CLAUDE.md` — this file (shared rules + project context)
- `PRODUCT_BRIEF.md` — product vision, roles, MVP scope, **plan tiers + AI/voice
  cost guardrails** (Hustle Hive docx нэгтгэл — read before plan/AI/limit work)
- `ROADMAP.md` — backend task list and build phases
- `MOBILE_ROADMAP.md` — mobile (frontend) task list + brand
- `ROLES.md` — user types, roles (student/teacher/admin/super_admin) +
  permissions matrix (read this to understand who can do what)
- `API.md` — full backend endpoint reference (path, auth level, purpose)
- `ADMIN_ROADMAP.md` — web admin dashboard plan (tech, phases, features)
- `TEAM_WORKFLOW.md` — **how the 4-dev team works to avoid code overlap /
  conflicts** (file ownership, shared-file protocol, backend→Bishrelt funnel,
  git rules). Read before touching shared files (`theme.ts`, `components/`,
  `/backend`, `API.md`).
- `VOCABULARY_SYSTEM.md` — **bulk vocabulary pipeline** (20k+ words: bulk
  upload → validate → media auto-match → review → publish → swipe + per-user
  progress + analytics). Read before any vocab/word/swipe/bulk-import work.

---

## Current Status (2026-06)

**Phase 1 — Foundation: DONE.** Built so far in `/backend`:

- NestJS + TypeScript project, PostgreSQL (TypeORM) + Redis wired up.
- All 14 entities created with UUID PKs, `created_at`/`updated_at`, jsonb where
  needed: User, Organization, Class, Lesson, Word, Quiz, Assignment, WordReview,
  XpLog, AiUsage, Message, Payment, SparksLog, LessonUnlock.
- `DB_SYNCHRONIZE=true` in dev auto-creates the schema from entities on boot.

**Auth module DONE:** register, login, JWT-protected `/me`, role-based guard
(`@Roles()` + `RolesGuard`). See `src/auth/` and `src/users/`.

Next up: Content modules + Leaderboard + Sparks store (see ROADMAP.md).

**Mobile UI/UX redesign — in progress (2026-06-12).** Brand moved to a new
**purple** direction (primary `#6C3BFF`, gradient, gold XP / blue gem / orange
streak), fox mascot + "SparkXP" name kept. Source: `mobile/DESIGN.md`,
`DESIGN_PROMPT.md` (+ `DESIGN_BRIEF.md`, `SCREEN_SPECS.md`).
Done: design tokens + shared components rebuilt; Home / Lessons (list+detail) /
Soril / Profile / Chat / Leaderboard / Swipe redesigned to mockups; bottom tab
center = AI buddy image. Home/Lessons skills → Сонсгол `listening` · Унших
`reading` · Нөхөх `fill` · Бичих `writing` (filter Lessons by `type`).
Shared `/backend`: `LessonType` gained `reading`/`writing`/`fill`; `seed.ts`
`synchronize:true`; `@types/multer` added; `API.md` updated — coordinate w/ Bishrelt.
Onboarding (3-slide) + login/register redesign shipped. **Teacher section (M5)
DONE & merged:** role-based tabs → classes (school+name), join code + QR,
approval-gated join (teacher approves requests), assign lessons/quizzes, teacher
"Чансаа" leaderboard (`scope=teacher`). **Auth overhauled & merged:** required
unique `username`, login by `identifier` (username **or** email), email-OTP
verify + password reset (MailService is a **stub** — plug SMTP/Resend later).
Student join-class (code/QR scanner) shipped. ⚠️ **Shared-backend changes that
affect Bishrelt's admin (auth/classes/leaderboard/orgs) + new mobile deps are
listed in `ROADMAP.md` → "Shared backend өөрчлөлт — Bishrelt АНХААР (2026-06-16)".**
**Next (mobile):** product-brief alignment (Phase M6 — level/English-name/
avatar/"Continue Learning"/student assignments). See `MOBILE_ROADMAP.md` + `PRODUCT_BRIEF.md`.
**Pending:** app icon files missing; fonts (Onest/Inter) not loaded; Lucide
migration; real gamification data (streak/level/progress are placeholders); real
video player. Full list: `MOBILE_ROADMAP.md`.

**Vocabulary AI pipeline — shipped (2026-06-25).** Admin Words page now does
end-to-end AI authoring:
- **AI text fill = Google Gemini** (not Anthropic anymore). `GEMINI_API_KEY` +
  `GEMINI_MODEL` (billing-enabled key required; free tier returns `limit:0`).
  `gemini-2.5-flash` is the stable default. Retries 429/503 + transient "high
  demand" 404. Words gained **`synonyms` / `antonyms`** columns (AI fills them).
- **Images = OpenAI** (`OPENAI_API_KEY`, needs billing), stored on Cloudinary
  with a **stable public_id + overwrite** → exactly 1 image per word. Prompt is a
  template (`IMAGE_PROMPT_TEMPLATE` env override; placeholders
  `{word}/{meaning}/{example_sentence}/{part_of_speech}/{cefr}`). `aiFill` no
  longer makes a throwaway preview image (cost fix).
- **Audio = ElevenLabs** (library voices need a paid plan); audio is generated
  once and served forever from Cloudinary.
- **Bulk:** `/words/ai-bulk` (CSV/list → AI fill, optional media, background +
  pollable `jobId`); **`/words/bulk-generate-media`** generates image/audio for
  selected existing words in the background (images in **parallel batches of 5**,
  ~61s apart for OpenAI's ~5/min limit; tune via `OPENAI_IMAGE_BATCH*`).
- Admin UX: filter by **`noImage`/`noAudio`** → select-all → bulk generate;
  progress bar with %; image lightbox; audio play; **"Заавар" (Guide) tab**.
- ⚠️ `.env.example` sanitized to placeholders (real keys were committed before).
  Prod runs `DB_SYNCHRONIZE=false` → new columns need a manual `ALTER TABLE`.

### Backend folder layout

```
backend/src/
  main.ts                 Entry: global ValidationPipe, /api prefix
  app.module.ts           Root module: Config + TypeORM + Redis
  config/
    typeorm.config.ts     Builds TypeORM options from env
    data-source.ts        Standalone DataSource for migration CLI
  redis/redis.module.ts   Global ioredis client (inject token: REDIS_CLIENT)
  common/
    entities/base.entity.ts   BaseEntity: UUID id + created_at/updated_at
    enums/index.ts            All shared enums
  entities/               12 entities + index.ts barrel (the `entities` array)
```

When adding a feature, create a module folder under `src/` (e.g.
`src/auth/`, `src/words/`) with its own `*.module.ts`, `*.controller.ts`,
`*.service.ts`, and `dto/`. Register the module in `app.module.ts`.

---

## Local Development Setup

Each developer sets up their own machine (the `.env` file is gitignored and
NOT shared — make your own from `.env.example`).

1. **Install & run Postgres + Redis** (macOS example):
   ```bash
   brew install postgresql@18 redis
   brew services start postgresql@18
   brew services start redis
   ```
2. **Create the DB role + database** (once):
   ```bash
   psql -d postgres -c "CREATE ROLE postgres LOGIN SUPERUSER PASSWORD 'postgres';"
   psql -d postgres -c "CREATE DATABASE englishxp OWNER postgres;"
   ```
3. **Configure & run the API**:
   ```bash
   cd backend
   cp .env.example .env     # edit credentials if yours differ
   npm install
   npm run start:dev        # http://localhost:3000/api
   ```

Inspect the database with `psql`, or a GUI (TablePlus / DBeaver) using:
host `localhost`, port `5432`, db `englishxp`, user `postgres`, pass `postgres`.

---

## Core Rules (do not break these)

- All learning content (words, lessons, quizzes) lives in the **DATABASE**,
  never hardcoded. Non-developers must be able to add content via admin panel.
- All AI calls go through a single **AI Gateway** module. Never call AI APIs
  directly from features. The gateway handles: per-user limits, logging,
  cost tracking, and saving chat history to `Message`.
- Plan limits (voice minutes, tokens, Sparks rate) must be configurable
  from admin/DB **without an app update**.
- Use **UUIDs** for all primary keys, not auto-increment ints.
- Use **jsonb** columns for flexible content (`lesson.content`, `quiz.questions`).
- Every table has `created_at` and `updated_at` (extend `BaseEntity`).
- Every `@ManyToOne` relation must have an explicit `@JoinColumn({ name: '...' })`
  to avoid duplicate FK columns. Nullable string columns need an explicit
  `type` (e.g. `@Column({ type: 'varchar', nullable: true })`), because TypeORM
  cannot infer the type from a `string | null` property.

## Data Model

Core entities (14): User, Organization, Class, Lesson, Word, Quiz, Assignment,
WordReview, XpLog, AiUsage, Message, Payment, SparksLog, LessonUnlock.

- **Organization** covers schools, companies, law firms. Its `type` is an
  open-ended string (NOT a fixed enum) so new org types can be added from
  admin/DB without a code change. Suggested defaults live in
  `ORG_TYPE_SUGGESTIONS`. Has `province`/`district` for local leaderboards.
- **User** roles: student, teacher, admin, super_admin (single User table,
  `role` enum field). `xp` and `sparks` counters live here for fast reads.
  Has `province`/`district`/`country` for local leaderboards (set at
  registration or inherited from the user's school/org).
- Students join a class via a `join_code`.
- `WordReview` holds SM-2 spaced-repetition state per (user, word).
- `XpLog` is the append-only source of truth for XP; `User.xp` is a cache.
- `SparksLog` is the append-only ledger for Sparks (twin of XpLog; `amount`
  can be negative for spending). `User.sparks` is a cache of the sum.
- `LessonUnlock` records a lesson bought with Sparks (permanent access, unique
  per user+lesson). `Lesson.priceSparks` = cost (0 = free).

### Leaderboards

- Ranked by **XP** (never Sparks — Sparks is spendable, so it would punish
  spending). XP is never destructively reset.
- "Resettable" periods are just **date windows over `XpLog.created_at`**:
  `weekly`, `monthly`, `all_time` (see `LeaderboardPeriod`).
- Scopes (`LeaderboardScope`): global, province, district, class, organization.
- MVP: compute with Postgres queries over XpLog. Optimize with Redis sorted
  sets (ZSET) only when scale needs it.
- Mongolia locations: `MN_PROVINCES` (21 aimags + Ulaanbaatar) and
  `UB_DISTRICTS` (9), kept as constant lists (not DB enums).

## Gamification

- XP = lifetime progress (logged in `XpLog`). Sparks = spendable currency.
- XP/Sparks require real interaction + correct answers (anti-abuse).

## Localization

- Bilingual: Mongolian-primary, English-secondary. Use Cyrillic-safe fonts.

---

## Build Phases (summary — full task list in ROADMAP.md)

- **Phase 1 (MVP):** student app — auth, vocabulary, grammar, listening,
  quizzes, XP, text AI buddy, basic admin.
- **Phase 2:** teacher dashboard, organizations, payments.
- **Phase 3:** voice AI, premium, Sparks store.
- For voice features in MVP: design the UI but show "coming soon" — don't build
  the STT/TTS logic yet.

## Code Conventions

- TypeScript everywhere. Clear names, small functions.
- Comment non-obvious logic.
- Validate all incoming data with DTOs + class-validator.
- Write code a junior dev can read.
- **DRY / less code.** Don't repeat yourself. If the same UI or logic appears
  twice, extract it into a **reusable component** (mobile) or a shared
  service/helper (backend) instead of copy-pasting. Prefer small, composable
  pieces over big duplicated blocks.

### Mobile (Expo) conventions

- Reusable UI lives in `mobile/src/components/` (e.g. `Button`, `TextField`,
  `SelectField`, `Logo`). Build a component once, reuse it everywhere — screens
  should mostly compose components, not redefine styles.
- Colors/spacing/type come from `mobile/src/theme/theme.ts` (no hardcoded hex
  in screens). User-facing text comes from `mobile/src/i18n` (Mongolian first).
- API calls go through `mobile/src/api/` (the `client.ts` fetch wrapper),
  never raw `fetch` inside a screen.
- Full plan + brand colors: see **MOBILE_ROADMAP.md**.

## Git Workflow (4-dev team)

> Full anti-conflict guide: **`TEAM_WORKFLOW.md`**. Core idea: **each dev only
> edits files in their own area** (Usukhbayar=`/admin`, Bishrelt=`/backend`,
> Choi/Boju=split `/mobile` routes); shared files (`theme.ts`, `components/`,
> `API.md`, `_layout.tsx`) are touched only via "announce → tiny PR → merge fast".
> Mobile devs don't edit `/backend` directly — request the endpoint from Bishrelt.

- **ALWAYS pull `main` BEFORE starting any task** (so you build on the other dev's
  latest and don't duplicate/conflict). This is the #1 rule — do it every time:
  ```bash
  git checkout main && git pull origin main
  git checkout <your-branch> && git merge main   # bring in their merged work
  ```
- `main` is always working/deployable. **Never push directly to `main`.**
- One branch per dev/task: `usukhbayar`, `bishrelt`, or `feature/...` / `fix/...`.
- Open a Pull Request, have the other dev review, then merge to `main`.
- Keep PRs small and frequent. Split work by module to avoid conflicts.
- `.env` is never committed (secrets). Update `.env.example` when adding new
  config keys so the other dev knows to set them.
