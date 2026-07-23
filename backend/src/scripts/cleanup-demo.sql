-- ============================================================================
-- Demo-data cleanup for production (HAND-OFF SCRIPT — review before running).
--
-- Removes the sample content the old `seed` / `seed:demo` scripts inserted.
-- It is targeted by the EXACT titles those scripts used, so it only ever hits
-- demo rows — never real content authored in the admin panel.
--
-- SAFETY:
--   * Subscription **Plans** are NOT touched.
--   * Real **users** are NOT touched (the only user block is the default demo
--     admin, and it is commented out — enable it consciously).
--   * The whole thing runs inside a transaction that ends in ROLLBACK, so
--     running it as-is is a DRY RUN: you see how many rows WOULD be deleted.
--     When the counts look right, change the final `ROLLBACK;` to `COMMIT;`.
--
-- USAGE:
--   psql "$DATABASE_URL" -f src/scripts/cleanup-demo.sql
-- ============================================================================

BEGIN;

-- Demo lessons, by the exact titles used by seed.ts + seed-demo.ts.
CREATE TEMP TABLE _demo_lessons ON COMMIT DROP AS
SELECT id FROM lessons WHERE title IN (
  -- seed.ts samples
  'Greeting Words (A1)',
  'Advanced Grammar (B1)',
  'Listening: Daily Conversations (A1)',
  'Reading: Short Stories (A2)',
  -- seed-demo.ts island lessons (one per CEFR level)
  'Forest — Мэндчилгээ ба танилцах',
  'Village — Өдөр тутмын амьдрал',
  'Castle — Унших чадвар',
  'Mountain — Зай нөхөх',
  'Space — Бичих чадвар',
  'Sky Realm — Дүрмийн нарийвчлал'
);

-- Quizzes belonging to those demo lessons (+ the standalone demo quiz).
CREATE TEMP TABLE _demo_quizzes ON COMMIT DROP AS
SELECT id FROM quizzes
WHERE lesson_id IN (SELECT id FROM _demo_lessons)
   OR title = 'Greeting Quiz (A1)';

-- Delete dependents first (FK-safe), then the demo lessons/quizzes themselves.
DELETE FROM quiz_attempts        WHERE quiz_id   IN (SELECT id FROM _demo_quizzes);
DELETE FROM assignments          WHERE target_id IN (SELECT id FROM _demo_quizzes)
                                    OR target_id IN (SELECT id FROM _demo_lessons);
DELETE FROM lesson_unlocks       WHERE lesson_id IN (SELECT id FROM _demo_lessons);
DELETE FROM quizzes              WHERE id        IN (SELECT id FROM _demo_quizzes);
DELETE FROM lessons              WHERE id        IN (SELECT id FROM _demo_lessons);

-- Demo reading passages, by the exact titles used by seed-demo.ts.
DELETE FROM reading_passages WHERE title IN (
  'My Day',
  'A Trip to the Village',
  'The Old Castle',
  'Climbing the Mountain',
  'Journey into Space',
  'The Sky Realm'
);

-- ── OPTIONAL: default demo admin ────────────────────────────────────────────
-- Enable ONLY if you did NOT repurpose admin@englishxp.mn as a real account.
-- DELETE FROM users WHERE email = 'admin@englishxp.mn' AND full_name = 'EnglishXP Admin';

-- ── OPTIONAL + RISKY: sample words ──────────────────────────────────────────
-- The seed inserted these common words. They are indistinguishable from real
-- vocabulary you may have imported since — DO NOT run this unless you are sure
-- these exact rows are still the untouched demo ones.
-- DELETE FROM words WHERE english IN
--   ('Hello','Goodbye','Please','Sorry','Friend','School','Learn','Practice','Understand');

-- ── Dry-run report ──────────────────────────────────────────────────────────
-- Row counts BELOW reflect the transaction state; ROLLBACK undoes it all.
-- Review, then change ROLLBACK → COMMIT to apply for real.
ROLLBACK;
