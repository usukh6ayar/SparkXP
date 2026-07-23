# Prod-readiness: real data persistence + seed removal

**Date:** 2026-07-23 · **Owner:** Өсөхбаяр · **Branch:** `chore/prod-readiness-data-persistence`

## Goal

Make the backend production-ready: user data persists correctly (avatar,
province/district), essential bootstrap data no longer depends on dev seed
scripts, dev-only seed tooling is removed, and gamification UI shows real
backend data instead of a placeholder. **No destructive action is run against
the production database** — DB changes ship as an idempotent migration and a
hand-off cleanup SQL that the owner reviews and runs.

## Context / findings

- `seed.ts` is **not** purely demo: it bootstraps the subscription **Plans**
  (`standard`/`plus`/`premier`) and an **admin user** — essential prod data.
  Naively deleting seed would remove the only place Plans are created.
- **Avatar bug:** `POST /users/me/avatar` writes to local disk
  (`process.cwd()/uploads`) and serves `${host}/uploads/...`. On Railway the
  container FS is ephemeral → avatars vanish on every redeploy. The project
  already has `ImageStorageService.storeMedia` (R2/Cloudinary, used by
  `upload.controller.ts`). Old disk avatars are already gone → no migration.
- **Province/District:** mobile sends `{ province?, district? }` to
  `PATCH /users/me`. The DTO validates `district` with `@IsIn(UB_DISTRICTS)`.
  A non-Ulaanbaatar user whose district is outside that list makes the **whole**
  PATCH 400 (class-validator rejects the entire body) → province is silently
  lost too. This is the reported "province/city doesn't save" bug.
- **Gamification is already real:** `GET /gamification` returns
  `streak`/`level`/`todayXp`/per-level progress from `XpLog` + `User`
  counters. Only the mobile `TopBar` streak badge is still a placeholder.

## Scope — work items (in order)

1. **Essential bootstrap → migration.** New idempotent migration seeds the 3
   Plans (upsert by `slug`) and, only when `ADMIN_EMAIL` + `ADMIN_PASSWORD`
   env are set **and** no admin exists, creates a super-admin. No hardcoded
   password. Safe to run on a prod DB that already has Plans/admin (skips).

2. **Remove seed tooling.** Delete `src/scripts/seed.ts`,
   `src/scripts/seed-demo.ts`, `src/scripts/words-seed.json`, and the
   `seed` / `seed:demo` scripts in `package.json`. (Only after #1 makes Plans
   independent of seed.)

3. **Avatar → cloud storage.** Rewrite `POST /users/me/avatar` to use
   `memoryStorage()` + `ImageStorageService.storeMedia` (image, folder
   `englishxp/avatars`), mirroring `upload.controller.ts`. `UsersModule`
   imports `AiGatewayModule` (exports `ImageStorageService`). Keep the
   `/uploads` static serve line for backwards compat (harmless). Returns the
   cloud URL, persisted via `setAvatar`.

4. **Fix province/district persistence.** Make the DTO tolerant: `district`
   only constrained when it belongs to a UB province, otherwise nullable /
   free-form, so a valid `province` never fails because of `district`. Verify
   the mobile edit flow only sends `district` for Ulaanbaatar (and clears it
   otherwise). Goal: a valid province always saves.

5. **Gamification wiring (mobile).** `TopBar` (and any other placeholder
   streak) consumes the real `GET /gamification` `streak`/`level` instead of
   the hardcoded placeholder.

6. **Demo-cleanup SQL (NOT executed).** Add `backend/src/scripts/cleanup-demo.sql`
   that deletes demo rows (sample seed words/lessons/quiz, demo admin if
   desired) **excluding Plans** and **excluding any real user data**. Owner
   reviews and runs it against prod manually.

## Out of scope (known remaining stubs — separate feature work)

QPay payments (`payments.service.ts` TODO), Expo Push (`notifications.service.ts`
TODO), Mail SMTP stub (`mail.module.ts`), AI Buddy `mockBuddies.ts` roster.
Left untouched; noted for later.

## Safety

- No delete/update is run against prod by this work.
- Migration is idempotent (upsert / existence-guarded).
- Cleanup SQL is a reviewed hand-off, Plans + real users explicitly excluded.

## Testing

- `npm run build` (backend) + `tsc --noEmit` (mobile) clean.
- Migration runs green on a fresh DB and is a no-op on a seeded DB.
- Manual: upload avatar → returns a cloud URL that survives restart; PATCH
  profile with a non-UB province saves; TopBar shows the real streak.
