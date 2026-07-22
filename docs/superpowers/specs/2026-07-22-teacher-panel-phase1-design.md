# Teacher Panel 2.0 — Phase 1 Design

> Date: 2026-07-22 · Owner: Өсөхбаяр (backend/admin) + Boju coordination (mobile teacher UI).
> Source of intent: this brainstorm + `docs/FUTURE_PLAN.md §6` + `ROADMAP.md → Update 4`.
> Scope chosen by product: (1) teacher sees student progress, (2) full assignment
> loop (due dates + submission tracking). Depth = **skill breakdown** (NOT mistakes+AI).

## Problem

The student↔teacher connection today is a thin one-way chain: a student joins a
class (approval-gated), the teacher assigns a lesson/quiz, the student marks it
"completed" (a boolean flag in `assignment_completions`). The teacher **sees
nothing** about how the student is actually learning — no scores, no per-skill
signal, no due dates, no "who hasn't done it yet." This is the main gap blocking
SparkXP from being sellable to schools / language centers, where teacher
oversight is the core retention lever.

Root data gap: **quiz scores are never persisted.** `POST /quizzes/:id/submit`
grades a quiz in memory (`scoreSubmission`) and writes only an `XpLog` row
(amount + source + reference_id — no score, no category). So any "skill
breakdown" is impossible from current data. Vocab is the exception: `WordReview`
(SM-2 SRS state) is real per-word mastery data.

## Goals

1. Persist every quiz attempt (score + skill category) so per-student and
   per-class skill breakdowns become computable.
2. Upgrade assignments into a real loop: due dates, per-student targeting,
   submission status (assigned / completed / late) and score.
3. Give teachers three read views: a dashboard, per-class analytics, and
   per-student progress.
4. Give students a clear assignment list (due date, status, score) + a push on
   new assignments.

## Non-goals (deferred)

- Common-mistakes analysis + AI suggestions (product did not select this depth).
- Two-way messaging / teacher comments / student→teacher chat.
- QPay / payments (separate track).
- Speaking skill scoring (Ярих is "coming soon"; no data to score yet).

## Headline decisions (approved)

1. **Skill dimensions come from real data:** **Listening / Reading / Writing /
   Fill (Нөхөх)** derived from a quiz, plus **Vocab** from `WordReview`.
   Speaking is deferred. We deliberately do NOT use the FUTURE_PLAN §6 taxonomy
   (Grammar/Vocab/Listening/Speaking) because Grammar and Speaking map to no
   stored data.
   **Important:** `quiz.category` is a **free-text varchar**, not a clean enum —
   for a standalone exercise (Дасгал) it holds the skill key
   (`listening`/`reading`/`writing`/`fill`), but for a lesson-linked quiz it may
   hold a Mongolian label ("Дүрэм"/"Үг"/"Сонсгол") or a sub-topic. So we do NOT
   trust it directly. A single **`resolveSkill(quiz)`** helper normalizes to a
   canonical dimension at attempt-write time:
   standalone quiz → its `category` skill key; lesson-linked quiz →
   `lesson.type` (`LessonType` = listening/reading/writing/fill); anything
   unmapped → `other` (excluded from the breakdown, still counted for activity).
2. **Foundation = new `quiz_attempt` table,** written inside the existing
   `POST /quizzes/:id/submit` endpoint (the single server-side grading point).
   It captures **all** practice — assigned and self-directed — so the breakdown
   reflects real learning, not just assigned quizzes.
3. **Extend the existing `assignment_completions` table into a submission
   record** (add status/score/submitted/attempts). Do NOT add a parallel
   `assignment_submissions` table — one "student did X" table only.
4. **Platform = mobile in-app teacher panel** — extend the existing `(teacher)`
   route group. ⚠️ `/mobile` teacher screens are Boju's area per `CLAUDE.md`;
   land these as small, announced PRs. Backend/admin is Өсөхбаяр's own area.

## Data model

### New: `quiz_attempt`

Written once per graded submission. The source of truth for skill breakdown.

| column | type | notes |
| --- | --- | --- |
| id | uuid | PK (BaseEntity) |
| user_id | uuid | FK users, `@JoinColumn` |
| quiz_id | uuid | FK quizzes, `@JoinColumn` |
| skill | varchar(nullable) | **normalized** canonical dimension from `resolveSkill(quiz)` (listening/reading/writing/fill/other) — NOT the raw free-text category |
| correct_count | int | |
| total_count | int | |
| score_pct | int | 0–100, derived (`round(correct/total*100)`); stored for cheap aggregation |
| assignment_id | uuid (nullable) | set when the attempt fulfils an assignment |
| created_at / updated_at | timestamptz | BaseEntity |

Index: `(user_id, skill)` and `(user_id, created_at)` for breakdown/activity
queries; `(assignment_id)` for submission linking.

### Extend: `assignment` (Assign 2.0)

Add:
- `due_date` timestamptz nullable
- `note` text/varchar nullable
- `student_ids` jsonb nullable — target a subset of the class; **null = whole
  class**. Validated against the class roster at assign time.

### Extend: `assignment_completions` (→ submission record)

Add:
- `status` enum(`assigned` | `completed` | `late`) default `completed`
  (migration backfills existing rows to `completed` — they only ever existed on
  completion).
- `score_pct` int nullable — copied from the fulfilling `quiz_attempt`; null for
  non-quiz content (lesson/reading = completion only).
- `submitted_at` timestamptz nullable
- `attempt_count` int default 0

Behaviour change: on assign, **pre-create** one row per targeted student with
`status='assigned'`. On completion, upsert the row to `completed` (or `late` if
past `due_date`) + score + submitted_at + attempt_count++. This makes
"who hasn't done it / overdue" a trivial query and powers the dashboard's
pending/overdue counts. The existing `@Unique(['assignmentId','studentId'])`
constraint is preserved (upsert target).

## Endpoints (backend)

### Write path (foundation)
- `POST /quizzes/:id/submit` — **extend** to persist a `quiz_attempt`
  (category from quiz, score from `scoreSubmission`). Accept optional
  `assignmentId` in the DTO; when present, link the attempt and upsert the
  submission row (status → completed/late, score, submitted_at, attempt_count++).
  XP behaviour unchanged (`awardOnce`, anti-farm).

### Teacher reads
- `GET /teacher/dashboard` — across all of the teacher's classes: total students,
  active students (activity in last 7 days), average progress, pending & overdue
  submission counts, class summaries. Role: teacher/admin.
- `GET /classes/:id/overview` — class analytics: completion %, average skill
  breakdown (5 dimensions), weakest skill, per-student summary rows (name,
  progress %, last active). Access: teacher-of-class / admin.
- `GET /classes/:id/students/:studentId/progress` — one student: skill breakdown,
  assignment history with scores/status, activity (XP, streak, last active).
  Access: teacher-of-class / admin.

### Assignment 2.0
- `POST /assignments` — **extend** DTO with `dueDate?`, `note?`, `studentIds?`.
  Pre-creates submission rows for targets. Role: teacher/admin.
- `GET /assignments/:id/submissions` — teacher view of who's done/pending/late +
  scores. Access: teacher-of-class / admin.
- `GET /assignments/mine` — **extend** student response to include `dueDate`,
  `status`, `scorePct` per assignment.

Skill breakdown computation (shared service): aggregate average
`quiz_attempt.score_pct` grouped by `skill` for the target user(s), over the four
mapped dimensions (listening/reading/writing/fill); `other` is excluded from the
breakdown. **Vocab** dimension = share of the student's reviewed words that are
"mature" in `WordReview` (SM-2 `interval_days >= 21`) — one explicit rule, not a
blend. A dimension with no data renders as "no data" (not 0%). Kept in one helper
so dashboard/class/student views stay DRY.

## UI/UX (mobile teacher panel)

- **Dashboard** (`(teacher)/index`): summary cards (students · active · avg
  progress · to-review) + My Classes list, each with a mini progress bar.
- **Class Detail** (`(teacher)/class/[id]`): completion ring, skill-breakdown
  bars (5 dims), a "weakest skill" chip, roster rows (name + progress % + last
  active), and an Assign button.
- **Student Progress** (new `(teacher)/class/[id]/student/[id]`): skill-breakdown
  bars, assignment history (title · status badge · score), activity (XP/streak).
- **Assign 2.0** (`(teacher)/class/[id]/assign`): content picker
  (lesson/quiz/reading) + due-date picker + note + **student multi-select**
  (All, or pick specific students).
- **Student side** (`app/assignments.tsx`): each row shows due date, a status
  badge (pending / overdue / done), and score when available; a push
  notification fires on new assignment.

Reuse existing components (`ClassCard`, `AssignmentRow`, progress/ring
components, theme tokens, i18n) — screens compose components per CODING_RULES.

## Build sequence (for the implementation plan)

1. `quiz_attempt` entity + migration + persist inside `POST /quizzes/:id/submit`
   (foundation; independently shippable — starts collecting data immediately).
2. Assign 2.0 backend: assignment columns + submission-row extension + pre-create
   on assign + submission upsert on submit + `GET /assignments/:id/submissions`.
3. Student progress endpoint + skill-breakdown helper + `student/[id]` screen.
4. Class analytics endpoint + Class Detail screen upgrade.
5. Teacher dashboard endpoint + Dashboard screen.
6. Student-side assignment list (due/status/score) + push on new assignment.

Each step is a small PR. Steps 1–2 are backend-only (Өсөхбаяр); steps 3–6 pair a
backend endpoint with a mobile screen (coordinate mobile with Boju).

## Testing

- Unit: skill-breakdown helper (category aggregation, empty-data, Vocab
  derivation), late-vs-completed status logic, `studentIds` roster validation.
- Integration: submit a quiz → `quiz_attempt` row + XP unchanged; assign to
  subset → correct pre-created rows; complete before/after due → completed/late;
  access control on every teacher read (non-teacher / other-class teacher → 403).
- Migration: existing `assignment_completions` rows backfill to `completed`.

## Risks / notes

- `student_ids` as jsonb (not a join table) keeps it simple; validate against the
  roster and keep the list small. Revisit if per-student assignment grows complex.
- Migrations run manually in prod (`DB_SYNCHRONIZE=false`) — ship a real
  migration for `quiz_attempt` + the column additions; update `.env`-free.
- Update `API.md` as each endpoint lands (Core Rule).
