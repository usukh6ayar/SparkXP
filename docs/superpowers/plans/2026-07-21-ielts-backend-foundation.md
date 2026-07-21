# IELTS Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the backend content model + IELTS band scoring so IELTS module-practice content (Listening / Reading / Writing / Speaking) can be authored and served, reusing the existing `Quiz` infrastructure (Approach A).

**Architecture:** IELTS content = existing `Quiz` rows tagged with an `ielts_*` category. Reuse the current question types (MCQ / fill_blank / word_match) for objective formats; add ONE new question type `open_response` for Writing/Speaking prompts (prompt + model answer, not auto-graded). Add two nullable `Quiz` columns (`passage_text`, `audio_url`). Listening/Reading submissions gain an approximate IELTS **band score** computed from the number of correct questions.

**Tech Stack:** NestJS + TypeORM (PostgreSQL) + class-validator. Follows `CODING_RULES.md` (less code / DRY / DTO validation / migration for new columns).

> **Verification note:** this repo has **no unit-test runner** (jest is configured for `*.e2e-spec.ts` only, which needs a live DB; there are 0 spec files and no eslint config). Per the project's actual convention (see how C2 `/quizzes/:id/check` was verified), each task is verified with **`node_modules/.bin/tsc --noEmit`** for type safety plus a **concrete manual/curl check with expected output**, and pure logic is verified with an explicit **input→expected hand-trace table**. Do NOT scaffold a new jest unit config — that violates the "less code" rule.

> **Scope:** This is **Plan 1 of 3** for IELTS Phase 1 (module practice), per `docs/superpowers/specs/2026-07-21-ielts-vertical-design.md`. It ships independently (authorable + curl-testable). Follow-ups: **Plan 2 — Admin IELTS authoring**, **Plan 3 — Mobile IELTS hub + runner + W/S practice** (mobile owner Choi/Boju — assign first). Mock tests are Phase 2 (separate spec).

> **Branch:** work on `feature/ielts-vertical` (already created). Never commit on `main`.
> **Commits:** every commit message in this plan must also end with the repo trailer
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (omitted from the snippets
> below for brevity).

---

## File Structure

| File | Responsibility | Create/Modify |
| --- | --- | --- |
| `backend/src/quizzes/ielts.ts` | IELTS category constants + `ieltsBand()` pure helper | **Create** |
| `backend/src/entities/quiz.entity.ts` | Add `passageText`, `audioUrl` columns | Modify |
| `backend/src/migrations/<ts>-AddIeltsQuizFields.ts` | Prod migration for the 2 columns | **Create** |
| `backend/src/quizzes/quizzes.service.ts` | `open_response` type: validate + grade-skip; keep `imageUrl` on MCQ; `band` on result | Modify |
| `backend/src/quizzes/dto/create-quiz.dto.ts` | `OpenResponseQuestionDto` + discriminator; `imageUrl` on MCQ; `passageText`/`audioUrl` | Modify |
| `backend/src/quizzes/quizzes.controller.ts` | Attach `band` to L/R IELTS submit result | Modify |
| `API.md` | Document IELTS categories, `open_response`, band on submit | Modify |

---

## Task 1: `ieltsBand` helper + IELTS category constants

**Files:**
- Create: `backend/src/quizzes/ielts.ts`

- [ ] **Step 1: Create the helper file**

Create `backend/src/quizzes/ielts.ts`:

```ts
/**
 * IELTS shared constants + band scoring.
 *
 * Content model (Approach A): IELTS content is a normal Quiz tagged with one of
 * these categories. Objective modules (listening/reading) are auto-scored into
 * an approximate band; writing/speaking are self-study (no score).
 */
export const IELTS_CATEGORIES = {
  listening: 'ielts_listening',
  reading: 'ielts_reading',
  writing: 'ielts_writing',
  speaking: 'ielts_speaking',
} as const;

/** Categories whose submissions get an auto band (objective answers). */
export const IELTS_OBJECTIVE_CATEGORIES: string[] = [
  IELTS_CATEGORIES.listening,
  IELTS_CATEGORIES.reading,
];

/**
 * Approximate IELTS band (0–9, half-steps) for an objective module from the raw
 * score. Official band tables assume a 40-question test; practice sets are
 * smaller, so we map by percentage (correct/total) to the nearest half-band
 * using anchor thresholds derived from the Academic conversion midpoints.
 */
export function ieltsBand(correct: number, total: number): number {
  if (total <= 0) return 0;
  const pct = correct / total;
  // [minPercentage, band] — highest threshold that pct meets wins.
  const anchors: [number, number][] = [
    [0.975, 9.0],
    [0.9, 8.5],
    [0.825, 8.0],
    [0.75, 7.5],
    [0.65, 7.0],
    [0.575, 6.5],
    [0.5, 6.0],
    [0.4, 5.5],
    [0.325, 5.0],
    [0.25, 4.5],
    [0.15, 4.0],
    [0.1, 3.5],
    [0.05, 3.0],
    [0.0, 2.5],
  ];
  for (const [threshold, band] of anchors) {
    if (pct >= threshold) return band;
  }
  return 0;
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && node_modules/.bin/tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Verify band mapping by hand-trace**

Confirm these inputs map as expected (read the `anchors` loop: first threshold `pct >=` wins):

| correct/total | pct | expected band |
| --- | --- | --- |
| 40/40 | 1.00 | 9.0 |
| 37/40 | 0.925 | 8.5 |
| 30/40 | 0.75 | 7.5 |
| 26/40 | 0.65 | 7.0 |
| 20/40 | 0.50 | 6.0 |
| 10/40 | 0.25 | 4.5 |
| 0/40 | 0.00 | 2.5 |
| 5/0 | — (total 0) | 0 |

If any row disagrees with the table, the anchors are wrong — fix `anchors`, don't fudge the trace.

- [ ] **Step 4: Commit**

```bash
cd /Users/usukhbayar/Desktop/Projects/SparkXP
git add backend/src/quizzes/ielts.ts
git commit -m "feat(ielts): band-score helper + category constants"
```

---

## Task 2: Add `passage_text` / `audio_url` columns to Quiz (+ migration)

**Files:**
- Modify: `backend/src/entities/quiz.entity.ts`
- Create: `backend/src/migrations/<timestamp>-AddIeltsQuizFields.ts`

- [ ] **Step 1: Add the columns to the entity**

In `backend/src/entities/quiz.entity.ts`, add these two columns immediately after the `topic` column (after its closing line `topic: string | null;`):

```ts
  /** IELTS Reading: the passage text shown above the questions. Null otherwise. */
  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passageText: string | null;

  /** IELTS Listening: the section audio (one recording per section). Null otherwise. */
  @Column({ name: 'audio_url', type: 'varchar', nullable: true })
  audioUrl: string | null;
```

- [ ] **Step 2: Type-check**

Run: `cd backend && node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Create the migration**

Look at an existing migration for the exact class/import style first:
Run: `ls backend/src/migrations && sed -n '1,40p' backend/src/migrations/*AddQuizTopic*.ts`

Create `backend/src/migrations/1785000000000-AddIeltsQuizFields.ts` (use `Date.now()`-style timestamp greater than the latest existing migration; match the imported `MigrationInterface`/`QueryRunner` style of the file you just read):

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIeltsQuizFields1785000000000 implements MigrationInterface {
  name = 'AddIeltsQuizFields1785000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "passage_text" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "audio_url" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "audio_url"`);
    await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN IF EXISTS "passage_text"`);
  }
}
```

- [ ] **Step 4: Type-check + confirm migration compiles**

Run: `cd backend && node_modules/.bin/tsc --noEmit`
Expected: exit 0.
(In dev, `DB_SYNCHRONIZE=true` auto-creates the columns; the migration is for prod where `DB_SYNCHRONIZE=false`.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/entities/quiz.entity.ts backend/src/migrations/1785000000000-AddIeltsQuizFields.ts
git commit -m "feat(ielts): passage_text + audio_url columns on quizzes (+migration)"
```

---

## Task 3: `open_response` question type — validate + grade-skip + keep imageUrl

**Files:**
- Modify: `backend/src/quizzes/quizzes.service.ts`

- [ ] **Step 1: Add `imageUrl` to McQuestion and add the OrQuestion interface**

In `backend/src/quizzes/quizzes.service.ts`, update the `McQuestion` interface to keep an optional image, and add a new `OrQuestion` interface after `WmQuestion`:

```ts
/** Shape we accept and store for a multiple-choice question. */
interface McQuestion {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correct: number;
  points: number;
  imageUrl?: string; // IELTS: picture / Writing-Task-1 chart (optional)
}
```

Add after the `WmQuestion` interface:

```ts
/** Open written/spoken response (IELTS Writing/Speaking) — self-study, not graded. */
interface OrQuestion {
  type: 'open_response';
  prompt: string;
  modelAnswer: string;
  imageUrl?: string; // Writing Task 1 chart/graph
  bandNote?: string; // band descriptor / guidance
  points: 0;
}
```

- [ ] **Step 2: Add OrQuestion to the union**

Change the `StoredQuestion` type:

```ts
type StoredQuestion = McQuestion | FbQuestion | WmQuestion | OrQuestion;
```

- [ ] **Step 3: Preserve imageUrl in the multiple_choice validate branch**

In `validateQuestions`, inside the `if (q.type === 'multiple_choice')` branch, change the returned object to carry `imageUrl` through:

```ts
        return {
          type: 'multiple_choice' as const,
          question: mc.question,
          options: mc.options as string[],
          correct: mc.correct,
          points: mc.points,
          ...(typeof mc.imageUrl === 'string' ? { imageUrl: mc.imageUrl } : {}),
        };
```

- [ ] **Step 4: Add the open_response validate branch**

In `validateQuestions`, add this branch after the `word_match` branch (before the final `throw new BadRequestException(... unknown type ...)`):

```ts
      if (q.type === 'open_response') {
        const or = q as Partial<OrQuestion>;
        if (
          typeof or.prompt !== 'string' ||
          !or.prompt.trim() ||
          typeof or.modelAnswer !== 'string'
        ) {
          throw new BadRequestException(
            `questions[${i}]: open_response requires prompt and modelAnswer`,
          );
        }
        return {
          type: 'open_response' as const,
          prompt: or.prompt,
          modelAnswer: or.modelAnswer,
          points: 0 as const,
          ...(typeof or.imageUrl === 'string' ? { imageUrl: or.imageUrl } : {}),
          ...(typeof or.bandNote === 'string' ? { bandNote: or.bandNote } : {}),
        };
      }
```

- [ ] **Step 5: Grade-skip open_response**

In `gradeQuestion`, no change is needed — it already `return false` for any type that isn't mc/fill_blank/word_match, so `open_response` scores 0 and never counts as correct. Add a one-line comment above the final `return false;` to make this explicit:

```ts
    // open_response (Writing/Speaking) is self-study only → never auto-correct.
    return false;
```

- [ ] **Step 6: Type-check**

Run: `cd backend && node_modules/.bin/tsc --noEmit`
Expected: exit 0. (If TS complains that `points: 0` isn't assignable, confirm `OrQuestion.points` is the literal `0` and the returned object uses `points: 0 as const`.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/quizzes/quizzes.service.ts
git commit -m "feat(ielts): open_response question type + keep MCQ imageUrl"
```

---

## Task 4: DTO — OpenResponseQuestionDto + passageText/audioUrl + MCQ imageUrl

**Files:**
- Modify: `backend/src/quizzes/dto/create-quiz.dto.ts`

- [ ] **Step 1: Add `imageUrl` to MultipleChoiceQuestionDto**

In `backend/src/quizzes/dto/create-quiz.dto.ts`, add to `MultipleChoiceQuestionDto` (after `points`):

```ts
  @IsOptional()
  @IsString()
  imageUrl?: string;
```

Ensure `IsOptional` is in the imports (it already is).

- [ ] **Step 2: Add OpenResponseQuestionDto**

Add after `WordMatchQuestionDto`:

```ts
/** Open written/spoken response (IELTS Writing/Speaking) — self-study, points 0. */
export class OpenResponseQuestionDto {
  @IsIn(['open_response'])
  type: 'open_response';

  @IsString()
  prompt: string;

  @IsString()
  modelAnswer: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  bandNote?: string;

  @IsInt()
  @Min(0)
  points: number;
}
```

- [ ] **Step 3: Add to the QuestionDto union + discriminator**

Update the union type:

```ts
export type QuestionDto =
  | MultipleChoiceQuestionDto
  | FillBlankQuestionDto
  | WordMatchQuestionDto
  | OpenResponseQuestionDto;
```

And add the subtype to the discriminator `subTypes` array in `CreateQuizDto.questions`:

```ts
        { value: OpenResponseQuestionDto, name: 'open_response' },
```

- [ ] **Step 4: Add passageText / audioUrl to CreateQuizDto**

Add after the `topic` field in `CreateQuizDto`:

```ts
  /** IELTS Reading passage text. */
  @IsOptional()
  @IsString()
  passageText?: string;

  /** IELTS Listening section audio URL. */
  @IsOptional()
  @IsString()
  audioUrl?: string;
```

(`UpdateQuizDto` extends `PartialType(CreateQuizDto)` and inherits these — confirm by reading `update-quiz.dto.ts`; if it does not use PartialType, add the same optional fields there.)

- [ ] **Step 5: Type-check**

Run: `cd backend && node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add backend/src/quizzes/dto/create-quiz.dto.ts
git commit -m "feat(ielts): DTO for open_response + passageText/audioUrl + MCQ imageUrl"
```

---

## Task 5: Attach `band` to Listening/Reading submit result

**Files:**
- Modify: `backend/src/quizzes/quizzes.service.ts` (QuizResult type)
- Modify: `backend/src/quizzes/quizzes.controller.ts`

- [ ] **Step 1: Add optional `band` to QuizResult**

In `backend/src/quizzes/quizzes.service.ts`, add to the `QuizResult` interface:

```ts
  /** Approximate IELTS band (0–9) — set only for ielts_listening/reading. */
  band?: number;
```

- [ ] **Step 2: Compute band in the controller submit()**

In `backend/src/quizzes/quizzes.controller.ts`, add the import near the top:

```ts
import { IELTS_OBJECTIVE_CATEGORIES, ieltsBand } from './ielts';
```

In `submit()`, after `const result = this.quizzesService.scoreSubmission(quiz, dto);` and before the XP block, add:

```ts
    // IELTS objective modules (listening/reading): report an approximate band,
    // computed from the number of correct QUESTIONS (not points).
    if (quiz.category && IELTS_OBJECTIVE_CATEGORIES.includes(quiz.category)) {
      const correctCount = result.breakdown.filter((b) => b.correct).length;
      result.band = ieltsBand(correctCount, result.breakdown.length);
    }
```

- [ ] **Step 3: Type-check**

Run: `cd backend && node_modules/.bin/tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Manual verify with curl (requires local backend + Postgres/Redis running)**

Start the API (`cd backend && npm run start:dev`). Then, using an admin JWT and a student JWT (obtain via `POST /api/auth/login`):

1. Create an IELTS reading quiz (admin token) with 2 MCQ questions where option index 0 is correct:

```bash
curl -sX POST localhost:3000/api/quizzes -H "Authorization: Bearer $ADMIN" \
 -H 'Content-Type: application/json' -d '{
  "title":"IELTS Reading Set 1","category":"ielts_reading","isPublished":true,
  "passageText":"Sample passage ...","xpReward":20,
  "questions":[
   {"type":"multiple_choice","question":"Q1","options":["True","False","Not Given"],"correct":0,"points":1},
   {"type":"multiple_choice","question":"Q2","options":["True","False","Not Given"],"correct":0,"points":1}
  ]}'
```

Note the returned quiz `id`.

2. Submit as a student, both correct:

```bash
curl -sX POST localhost:3000/api/quizzes/$QUIZ_ID/submit -H "Authorization: Bearer $STUDENT" \
 -H 'Content-Type: application/json' \
 -d '{"answers":[{"questionIndex":0,"answer":0},{"questionIndex":1,"answer":0}]}'
```

Expected: JSON includes `"band": 9` (2/2 correct → pct 1.0 → band 9), plus `percentage: 100`, `passed: true`.

3. Submit one wrong (`answer:1` for Q2) → expect `"band"` around 6 (1/2 = 0.5 → band 6.0).

4. Submit an `ielts_writing` quiz's `/submit` is NOT used (self-study). Confirm a non-IELTS quiz response has **no** `band` field.

- [ ] **Step 5: Commit**

```bash
git add backend/src/quizzes/quizzes.service.ts backend/src/quizzes/quizzes.controller.ts
git commit -m "feat(ielts): return approximate band on listening/reading submit"
```

---

## Task 6: Document in API.md

**Files:**
- Modify: `API.md`

- [ ] **Step 1: Update the quizzes section**

In `API.md`, in the Quizzes section (§6), add a note row/paragraph after the `/quizzes/:id/submit` row:

```markdown
> **IELTS (Approach A):** IELTS content = quizzes with `category` in
> `ielts_listening` / `ielts_reading` / `ielts_writing` / `ielts_speaking`.
> Reading uses `passage_text`, Listening uses `audio_url`. Writing/Speaking use
> the `open_response` question type (`prompt` + `modelAnswer` + optional
> `imageUrl`/`bandNote`, `points:0`, self-study — no submit). Listening/Reading
> `POST /quizzes/:id/submit` responses include an approximate **`band`** (0–9)
> from the count of correct questions.
```

- [ ] **Step 2: Commit**

```bash
git add API.md
git commit -m "docs(ielts): document IELTS categories, open_response, band on API.md"
```

---

## Self-Review Checklist (run before handing off to execution)

- [ ] `node_modules/.bin/tsc --noEmit` is clean after every task.
- [ ] `open_response` never affects scoring (gradeQuestion returns false; points 0).
- [ ] `band` only appears for `ielts_listening`/`ielts_reading` submissions.
- [ ] Migration column names (`passage_text`, `audio_url`) match the entity `@Column({ name })`.
- [ ] DTO field names (`passageText`, `audioUrl`, `imageUrl`, `prompt`, `modelAnswer`, `bandNote`) match the service `validateQuestions` reads exactly.
- [ ] No new jest/unit config was added (project convention).

## Next plans (not in this plan)

- **Plan 2 — Admin IELTS authoring** (`/admin`): IELTS category in the Quiz/Дасгал authoring, `open_response` editor, passage/audio fields, `ieltsModuleOptions`.
- **Plan 3 — Mobile IELTS hub + runner + W/S practice** (`/mobile`): Home entry → `/ielts` hub → module lists → reuse quiz runner for L/R (show band), new W/S practice screen (model-answer reveal). **Assign a mobile owner (Choi/Boju) first.**
