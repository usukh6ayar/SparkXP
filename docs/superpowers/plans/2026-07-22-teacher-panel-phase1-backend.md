# Teacher Panel 2.0 — Phase 1 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give teachers real visibility into student learning (dashboard, class analytics, per-student skill breakdown) and a full assignment loop (due dates, per-student targeting, submission status + score) — all backend, feeding off a new persisted `quiz_attempt` record.

**Architecture:** A new `teacher` module owns the `QuizAttempt` entity, a shared `ProgressService` (record attempts, compute skill breakdowns, build the three read views), and a `TeacherController`. The existing `POST /quizzes/:id/submit` calls `ProgressService.recordAttempt` so **every** graded quiz — assigned or self-directed — is captured with a normalized skill. The existing `assignment_completions` table is extended into a submission record (status/score/submitted/attempts); assignments gain `note` + `studentIds`.

**Tech Stack:** NestJS + TypeORM + PostgreSQL, Jest (ts-jest) for the pure-function unit tests. Migrations are hand-written (prod runs `DB_SYNCHRONIZE=false`).

**Scope note:** This plan is backend-only (Өсөхбаяр's area — no cross-dev coordination). Mobile teacher screens + push are a separate plan (`docs/superpowers/plans/…-teacher-panel-phase1-mobile.md`, coordinate with Boju).

**Spec:** `docs/superpowers/specs/2026-07-22-teacher-panel-phase1-design.md`

---

## File structure

- Create `backend/src/teacher/skill.ts` — `Skill` type + `resolveSkill()` pure helper.
- Create `backend/src/teacher/skill.spec.ts` — unit tests for `resolveSkill`.
- Create `backend/src/entities/quiz-attempt.entity.ts` — `QuizAttempt`.
- Create `backend/src/teacher/teacher.module.ts` / `progress.service.ts` / `teacher.controller.ts`.
- Create `backend/src/teacher/progress.spec.ts` — unit tests for breakdown math.
- Modify `backend/src/entities/index.ts` — register `QuizAttempt`.
- Modify `backend/src/entities/assignment.entity.ts` — add `note`, `studentIds`.
- Modify `backend/src/entities/assignment-completion.entity.ts` — add status/score/submitted/attempts.
- Modify `backend/src/common/enums/index.ts` — add `SubmissionStatus`.
- Modify `backend/src/quizzes/*` — call `recordAttempt` in submit; `assignmentId` on DTO.
- Modify `backend/src/assignments/*` — pre-create submissions, upsert on submit, `GET :id/submissions`, DTO fields.
- Create `backend/src/migrations/1785600000000-TeacherPanelPhase1.ts`.
- Modify `backend/API.md`.

---

## Phase A — Foundation: persist every quiz attempt

### Task 1: `resolveSkill` pure helper

**Files:**
- Create: `backend/src/teacher/skill.ts`
- Test: `backend/src/teacher/skill.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/teacher/skill.spec.ts
import { resolveSkill } from './skill';
import { LessonType } from '../common/enums';

describe('resolveSkill', () => {
  it('uses the category when it is a known skill key', () => {
    expect(resolveSkill('listening', null)).toBe('listening');
    expect(resolveSkill('reading', LessonType.WRITING)).toBe('reading'); // category wins
    expect(resolveSkill('fill', null)).toBe('fill');
  });

  it('falls back to the lesson type when category is a free-text label', () => {
    expect(resolveSkill('Дүрэм', LessonType.WRITING)).toBe('writing');
    expect(resolveSkill('Сонсгол', LessonType.LISTENING)).toBe('listening');
    expect(resolveSkill(null, LessonType.READING)).toBe('reading');
  });

  it('returns "other" when nothing maps', () => {
    expect(resolveSkill('Дүрэм', null)).toBe('other');
    expect(resolveSkill(null, null)).toBe('other');
    expect(resolveSkill('speaking', null)).toBe('other'); // speaking deferred
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest --config jest.config.ts src/teacher/skill.spec.ts`
Expected: FAIL — "Cannot find module './skill'".

- [ ] **Step 3: Write minimal implementation**

```typescript
// backend/src/teacher/skill.ts
import { LessonType } from '../common/enums';

/** The four scored skill dimensions (Speaking deferred). `other` = unmapped. */
export type Skill = 'listening' | 'reading' | 'writing' | 'fill' | 'other';

const SKILL_KEYS: Skill[] = ['listening', 'reading', 'writing', 'fill'];

/**
 * Normalize a quiz to a canonical skill dimension for the teacher breakdown.
 * `quiz.category` is free text (a Дасгал holds the skill key; a lesson-linked
 * quiz may hold a Mongolian label), so we trust the category only when it is
 * itself a skill key, else fall back to the parent lesson's type.
 */
export function resolveSkill(
  category: string | null,
  lessonType: LessonType | null,
): Skill {
  if (category && (SKILL_KEYS as string[]).includes(category)) {
    return category as Skill;
  }
  if (lessonType && (SKILL_KEYS as string[]).includes(lessonType)) {
    return lessonType as unknown as Skill;
  }
  return 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest --config jest.config.ts src/teacher/skill.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/teacher/skill.ts backend/src/teacher/skill.spec.ts
git commit -m "feat(teacher): resolveSkill helper — normalize quiz to a skill dimension"
```

---

### Task 2: `QuizAttempt` entity + register

**Files:**
- Create: `backend/src/entities/quiz-attempt.entity.ts`
- Modify: `backend/src/entities/index.ts`

- [ ] **Step 1: Create the entity**

```typescript
// backend/src/entities/quiz-attempt.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { Quiz } from './quiz.entity';

/**
 * One graded quiz submission. The source of truth for skill breakdowns —
 * written on every POST /quizzes/:id/submit (assigned or self-directed).
 * `skill` is the NORMALIZED dimension (see teacher/skill.ts), not the raw
 * free-text quiz category.
 */
@Entity('quiz_attempts')
@Index(['userId', 'skill'])
@Index(['userId', 'createdAt'])
@Index(['assignmentId'])
export class QuizAttempt extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Quiz, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quiz_id' })
  quiz: Quiz;

  @Column({ name: 'quiz_id', type: 'uuid' })
  quizId: string;

  /** Normalized skill: listening | reading | writing | fill | other. */
  @Column({ type: 'varchar' })
  skill: string;

  @Column({ name: 'correct_count', type: 'int', default: 0 })
  correctCount: number;

  @Column({ name: 'total_count', type: 'int', default: 0 })
  totalCount: number;

  /** 0–100, stored for cheap aggregation. */
  @Column({ name: 'score_pct', type: 'int', default: 0 })
  scorePct: number;

  /** Set when this attempt fulfils an assignment. */
  @Column({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId: string | null;
}
```

- [ ] **Step 2: Register in the entities barrel**

In `backend/src/entities/index.ts`, add the import and include `QuizAttempt` in the exported `entities` array (follow the existing pattern of the other entities in that file).

```typescript
// add with the other imports
import { QuizAttempt } from './quiz-attempt.entity';
// ...add QuizAttempt to the `entities` array and re-export it alongside the others
export { QuizAttempt };
```

- [ ] **Step 3: Verify it compiles**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors referencing `quiz-attempt.entity`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/entities/quiz-attempt.entity.ts backend/src/entities/index.ts
git commit -m "feat(teacher): QuizAttempt entity (persisted quiz score + skill)"
```

---

### Task 3: `teacher` module + `ProgressService.recordAttempt`, wired into quiz submit

**Files:**
- Create: `backend/src/teacher/teacher.module.ts`
- Create: `backend/src/teacher/progress.service.ts`
- Modify: `backend/src/quizzes/dto/submit-quiz.dto.ts`
- Modify: `backend/src/quizzes/quizzes.module.ts`
- Modify: `backend/src/quizzes/quizzes.controller.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create `ProgressService` with `recordAttempt`**

```typescript
// backend/src/teacher/progress.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { resolveSkill } from './skill';

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(QuizAttempt)
    private readonly attempts: Repository<QuizAttempt>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
  ) {}

  /**
   * Persist one graded quiz submission. Called from POST /quizzes/:id/submit.
   * Resolves the skill from the quiz category, falling back to the parent
   * lesson's type only when the category is not itself a skill key.
   */
  async recordAttempt(params: {
    userId: string;
    quiz: Quiz;
    correctCount: number;
    totalCount: number;
    scorePct: number;
    assignmentId?: string | null;
  }): Promise<QuizAttempt> {
    let lessonType = null as Lesson['type'] | null;
    // Only pay for the lookup when the category can't answer it on its own.
    if (params.quiz.lessonId) {
      const lesson = await this.lessons.findOne({
        where: { id: params.quiz.lessonId },
        select: { id: true, type: true },
      });
      lessonType = lesson?.type ?? null;
    }
    const skill = resolveSkill(params.quiz.category, lessonType);
    const attempt = this.attempts.create({
      userId: params.userId,
      quizId: params.quiz.id,
      skill,
      correctCount: params.correctCount,
      totalCount: params.totalCount,
      scorePct: params.scorePct,
      assignmentId: params.assignmentId ?? null,
    });
    return this.attempts.save(attempt);
  }
}
```

- [ ] **Step 2: Create the module**

```typescript
// backend/src/teacher/teacher.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizAttempt } from '../entities/quiz-attempt.entity';
import { Lesson } from '../entities/lesson.entity';
import { ProgressService } from './progress.service';

/** Teacher-facing progress: persist quiz attempts + (later) read views. */
@Module({
  imports: [TypeOrmModule.forFeature([QuizAttempt, Lesson])],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class TeacherModule {}
```

- [ ] **Step 3: Register `TeacherModule` in `app.module.ts`**

Add `import { TeacherModule } from './teacher/teacher.module';` and put `TeacherModule` in the root module's `imports` array (next to the other feature modules).

- [ ] **Step 4: Add optional `assignmentId` to `SubmitQuizDto`**

In `backend/src/quizzes/dto/submit-quiz.dto.ts`, add to the `SubmitQuizDto` class:

```typescript
import { IsArray, ValidateNested, IsInt, Min, Allow, IsOptional, IsUUID } from 'class-validator';
// ...inside SubmitQuizDto, after `answers`:
  /** When the student is fulfilling an assignment, its id (links the attempt). */
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
```

- [ ] **Step 5: Let QuizzesModule use ProgressService**

In `backend/src/quizzes/quizzes.module.ts`, add `TeacherModule` to `imports` (import it at the top). This exposes `ProgressService` to the quizzes controller.

- [ ] **Step 6: Call `recordAttempt` in the submit handler**

In `backend/src/quizzes/quizzes.controller.ts`, inject `ProgressService` in the constructor and record the attempt after scoring, before returning. Add after the XP block:

```typescript
// constructor: add `private readonly progress: ProgressService,`
// import: import { ProgressService } from '../teacher/progress.service';

// after the `if (result.xpEarned > 0) { ... }` block, before `return result;`
await this.progress.recordAttempt({
  userId: user.id,
  quiz,
  correctCount: result.breakdown.filter((b) => b.correct).length,
  totalCount: result.breakdown.length,
  scorePct: result.percentage,
  assignmentId: dto.assignmentId ?? null,
});
```

- [ ] **Step 7: Verify build + start**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Manual smoke test** (needs a local DB with `DB_SYNCHRONIZE=true`)

Start the API, log in as a student, POST a quiz submission, then confirm a row landed:

Run: `psql -d englishxp -c "SELECT user_id, skill, score_pct, assignment_id FROM quiz_attempts ORDER BY created_at DESC LIMIT 3;"`
Expected: one row per submit, `skill` one of listening/reading/writing/fill/other, `score_pct` matching the result.

- [ ] **Step 9: Commit**

```bash
git add backend/src/teacher backend/src/quizzes backend/src/app.module.ts
git commit -m "feat(teacher): persist quiz_attempt on submit via ProgressService"
```

---

## Phase B — Assignment 2.0: due dates, targeting, submissions

### Task 4: `SubmissionStatus` enum + extend the two tables

**Files:**
- Modify: `backend/src/common/enums/index.ts`
- Modify: `backend/src/entities/assignment.entity.ts`
- Modify: `backend/src/entities/assignment-completion.entity.ts`

- [ ] **Step 1: Add the enum**

In `backend/src/common/enums/index.ts`, add near `AssignmentType`:

```typescript
/** Lifecycle of one student's assignment submission. */
export enum SubmissionStatus {
  ASSIGNED = 'assigned',
  COMPLETED = 'completed',
  LATE = 'late',
}
```

- [ ] **Step 2: Add `note` + `studentIds` to `Assignment`**

In `backend/src/entities/assignment.entity.ts`, add columns (after `dueAt`):

```typescript
  /** Optional teacher note shown with the task. */
  @Column({ type: 'varchar', nullable: true })
  note: string | null;

  /** Target a subset of the class. NULL = the whole class. */
  @Column({ name: 'student_ids', type: 'jsonb', nullable: true })
  studentIds: string[] | null;
```

- [ ] **Step 3: Extend `AssignmentCompletion` into a submission record**

In `backend/src/entities/assignment-completion.entity.ts`, add the import for `SubmissionStatus` and these columns (keep the existing `@Unique(['assignmentId','studentId'])`):

```typescript
import { SubmissionStatus } from '../common/enums';
// ...
  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.COMPLETED })
  status: SubmissionStatus;

  @Column({ name: 'score_pct', type: 'int', nullable: true })
  scorePct: number | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;
```

The `default: COMPLETED` is intentional: every row that existed before this change was written only on completion.

- [ ] **Step 4: Verify build**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/enums/index.ts backend/src/entities/assignment.entity.ts backend/src/entities/assignment-completion.entity.ts
git commit -m "feat(teacher): SubmissionStatus + assignment note/studentIds + submission columns"
```

---

### Task 5: Pre-create submissions on assign; upsert on submit

**Files:**
- Modify: `backend/src/assignments/dto/create-assignment.dto.ts`
- Modify: `backend/src/assignments/assignments.service.ts`

- [ ] **Step 1: Extend the create DTO**

In `backend/src/assignments/dto/create-assignment.dto.ts` add:

```typescript
import { IsUUID, IsEnum, IsOptional, IsDateString, IsString, IsArray, MaxLength } from 'class-validator';
// ...inside CreateAssignmentDto:
  /** Optional teacher note. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Target specific students (must be in the class). Omit = whole class. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  studentIds?: string[];
```

- [ ] **Step 2: In `create()`, resolve targets, save note/studentIds, pre-create rows**

Replace the assignment-build block in `assignments.service.ts` `create()` (the `this.assignments.create({...})` + `save`) with:

```typescript
// Resolve the target roster: explicit studentIds (validated against the class)
// or the whole class. getStudents enforces teacher/admin access already.
const roster = await this.classesService.getStudents(dto.classId, user);
const rosterIds = new Set(roster.map((s) => s.id));
let targetIds = roster.map((s) => s.id);
if (dto.studentIds?.length) {
  const invalid = dto.studentIds.filter((id) => !rosterIds.has(id));
  if (invalid.length) {
    throw new BadRequestException('Сонгосон сурагч энэ ангид алга');
  }
  targetIds = dto.studentIds;
}

const assignment = await this.assignments.save(
  this.assignments.create({
    classId: dto.classId,
    type: dto.type,
    targetId: dto.targetId,
    assignedById: user.id,
    dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    note: dto.note ?? null,
    studentIds: dto.studentIds?.length ? dto.studentIds : null,
  }),
);

// Pre-create one submission row per target so "pending / overdue" is queryable.
if (targetIds.length) {
  await this.completions
    .createQueryBuilder()
    .insert()
    .into(AssignmentCompletion)
    .values(
      targetIds.map((studentId) => ({
        assignmentId: assignment.id,
        studentId,
        status: SubmissionStatus.ASSIGNED,
      })),
    )
    .orIgnore()
    .execute();
}
return assignment;
```

Add imports at the top of the file: `BadRequestException` (from `@nestjs/common`) and `SubmissionStatus` (from `../common/enums`), if not already present.

- [ ] **Step 2b: Add a `recordSubmission` method (upsert on completion)**

Add to `assignments.service.ts`:

```typescript
/**
 * Mark a student's submission for an assignment: updates the pre-created row,
 * or inserts one if the student joined after the assign. `late` when past due.
 */
async recordSubmission(
  assignmentId: string,
  studentId: string,
  scorePct: number | null,
): Promise<void> {
  const assignment = await this.assignments.findOne({
    where: { id: assignmentId },
    select: { id: true, dueAt: true },
  });
  if (!assignment) throw new NotFoundException('Даалгавар олдсонгүй');
  const status =
    assignment.dueAt && new Date() > assignment.dueAt
      ? SubmissionStatus.LATE
      : SubmissionStatus.COMPLETED;

  const res = await this.completions
    .createQueryBuilder()
    .update(AssignmentCompletion)
    .set({
      status,
      scorePct: scorePct ?? undefined,
      submittedAt: () => 'now()',
      attemptCount: () => 'attempt_count + 1',
    })
    .where('assignment_id = :assignmentId AND student_id = :studentId', {
      assignmentId,
      studentId,
    })
    .execute();

  if (!res.affected) {
    await this.completions
      .createQueryBuilder()
      .insert()
      .into(AssignmentCompletion)
      .values({
        assignmentId,
        studentId,
        status,
        scorePct: scorePct ?? null,
        submittedAt: new Date(),
        attemptCount: 1,
      })
      .orIgnore()
      .execute();
  }
}
```

- [ ] **Step 3: Route the existing `complete()` through `recordSubmission`**

Replace the body of `complete(assignmentId, userId)` so a lesson/reading "done" tap records a scoreless submission:

```typescript
async complete(assignmentId: string, userId: string): Promise<void> {
  await this.recordSubmission(assignmentId, userId, null);
}
```

- [ ] **Step 4: Link quiz submissions.** In `quizzes.controller.ts` submit handler, when `dto.assignmentId` is present, also record the submission with the score. Inject `AssignmentsService` (import `AssignmentsModule` into `QuizzesModule`) and add after `recordAttempt`:

```typescript
if (dto.assignmentId) {
  await this.assignments.recordSubmission(dto.assignmentId, user.id, result.percentage);
}
```

(constructor: `private readonly assignments: AssignmentsService,`)

- [ ] **Step 5: Verify build**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors. (If `QuizzesModule ↔ AssignmentsModule` form a cycle, wrap the imports with `forwardRef(() => …)` on both sides.)

- [ ] **Step 6: Manual smoke test**

Assign a quiz to 2 selected students → expect 2 `assignment_completions` rows `status='assigned'`. Submit as one student with `assignmentId` → that row flips to `completed`/`late` with `score_pct` set and `attempt_count=1`.

Run: `psql -d englishxp -c "SELECT student_id, status, score_pct, attempt_count FROM assignment_completions WHERE assignment_id='<id>';"`

- [ ] **Step 7: Commit**

```bash
git add backend/src/assignments backend/src/quizzes
git commit -m "feat(teacher): pre-create submissions on assign + record score/late on submit"
```

---

### Task 6: `GET /assignments/:id/submissions` (teacher view)

**Files:**
- Modify: `backend/src/assignments/assignments.service.ts`
- Modify: `backend/src/assignments/assignments.controller.ts`

- [ ] **Step 1: Service method**

```typescript
/** Teacher view: every targeted student's submission for one assignment. */
async submissionsFor(assignmentId: string, user: User) {
  const assignment = await this.assignments.findOne({ where: { id: assignmentId } });
  if (!assignment) throw new NotFoundException('Даалгавар олдсонгүй');
  // Reuse class access control (throws 403 if not the class teacher/admin).
  await this.classesService.getStudents(assignment.classId, user);
  const rows = await this.completions.find({
    where: { assignmentId },
    relations: ['student'],
    order: { status: 'ASC', submittedAt: 'DESC' },
  });
  return rows.map((r) => ({
    studentId: r.studentId,
    fullName: r.student?.fullName ?? null,
    status: r.status,
    scorePct: r.scorePct,
    submittedAt: r.submittedAt,
    attemptCount: r.attemptCount,
  }));
}
```

- [ ] **Step 2: Controller route** (teacher/admin only)

```typescript
@Get(':id/submissions')
@UseGuards(RolesGuard)
@Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
submissions(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
  return this.assignmentsService.submissionsFor(id, user);
}
```

- [ ] **Step 3: Verify + smoke test**

Run: `cd backend && npx tsc --noEmit` then GET the route with a teacher token; expect the roster with statuses/scores.

- [ ] **Step 4: Commit**

```bash
git add backend/src/assignments
git commit -m "feat(teacher): GET /assignments/:id/submissions"
```

---

## Phase C — Read views: breakdown, student, class, dashboard

### Task 7: Skill-breakdown + vocab helper (tested)

**Files:**
- Modify: `backend/src/teacher/progress.service.ts`
- Modify: `backend/src/teacher/teacher.module.ts`
- Create: `backend/src/teacher/progress.spec.ts`

- [ ] **Step 1: Write the failing test for the pure aggregation**

```typescript
// backend/src/teacher/progress.spec.ts
import { averageBySkill, SKILL_DIMENSIONS } from './progress.service';

describe('averageBySkill', () => {
  it('averages score_pct per mapped skill and ignores "other"', () => {
    const out = averageBySkill([
      { skill: 'listening', scorePct: 80 },
      { skill: 'listening', scorePct: 60 },
      { skill: 'reading', scorePct: 90 },
      { skill: 'other', scorePct: 10 },
    ]);
    expect(out.listening).toBe(70);
    expect(out.reading).toBe(90);
    expect(out.writing).toBeNull(); // no data → null, not 0
    expect(out.fill).toBeNull();
    expect('other' in out).toBe(false);
  });

  it('lists exactly the four scored dimensions', () => {
    expect(SKILL_DIMENSIONS).toEqual(['listening', 'reading', 'writing', 'fill']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && npx jest --config jest.config.ts src/teacher/progress.spec.ts`
Expected: FAIL — `averageBySkill` not exported.

- [ ] **Step 3: Implement the pure helper + wire repos**

Add to the top of `progress.service.ts` (module-level, exported, pure):

```typescript
export const SKILL_DIMENSIONS = ['listening', 'reading', 'writing', 'fill'] as const;
export type SkillBreakdown = Record<(typeof SKILL_DIMENSIONS)[number], number | null>;

/** Average score_pct per mapped skill; unseen dimensions → null; 'other' dropped. */
export function averageBySkill(
  rows: { skill: string; scorePct: number }[],
): SkillBreakdown {
  const sums: Record<string, { total: number; n: number }> = {};
  for (const r of rows) {
    if (!(SKILL_DIMENSIONS as readonly string[]).includes(r.skill)) continue;
    (sums[r.skill] ??= { total: 0, n: 0 }).total += r.scorePct;
    sums[r.skill].n += 1;
  }
  const out = {} as SkillBreakdown;
  for (const s of SKILL_DIMENSIONS) {
    out[s] = sums[s] ? Math.round(sums[s].total / sums[s].n) : null;
  }
  return out;
}
```

- [ ] **Step 4: Add a `vocabMastery` method + WordReview repo**

Add `WordReview` to `teacher.module.ts` `forFeature([QuizAttempt, Lesson, WordReview])` (import it). In `ProgressService`, inject `@InjectRepository(WordReview) private readonly reviews: Repository<WordReview>` and add:

```typescript
/** Vocab dimension: % of the student's reviewed words that are "mature". */
async vocabMastery(userId: string): Promise<number | null> {
  const total = await this.reviews.count({ where: { userId } });
  if (total === 0) return null;
  const mature = await this.reviews.count({
    where: { userId, intervalDays: MoreThanOrEqual(21) },
  });
  return Math.round((mature / total) * 100);
}
```

Import `MoreThanOrEqual` from `typeorm` and `WordReview` from `../entities/word-review.entity`.

- [ ] **Step 5: Add `studentSkillRows` (DB read feeding `averageBySkill`)**

```typescript
/** Raw skill rows for a user, for averageBySkill(). */
studentSkillRows(userId: string): Promise<{ skill: string; scorePct: number }[]> {
  return this.attempts.find({
    where: { userId },
    select: { skill: true, scorePct: true },
  }) as Promise<{ skill: string; scorePct: number }[]>;
}
```

- [ ] **Step 6: Run the test**

Run: `cd backend && npx jest --config jest.config.ts src/teacher/progress.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add backend/src/teacher
git commit -m "feat(teacher): skill-breakdown aggregation + vocab mastery helper (tested)"
```

---

### Task 8: `GET /classes/:id/students/:studentId/progress`

**Files:**
- Modify: `backend/src/teacher/progress.service.ts`
- Create: `backend/src/teacher/teacher.controller.ts`
- Modify: `backend/src/teacher/teacher.module.ts`

- [ ] **Step 1: Service method** — reuse ClassesService for access + assignment history.

Add `ClassesModule` to `teacher.module.ts` imports, and `AssignmentCompletion` + `Assignment` to `forFeature`. Inject `ClassesService`, the two repos. Then:

```typescript
async studentProgress(classId: string, studentId: string, teacher: User) {
  // Throws 403 unless the caller teaches this class (or is admin).
  const roster = await this.classes.getStudents(classId, teacher);
  if (!roster.some((s) => s.id === studentId)) {
    throw new NotFoundException('Сурагч энэ ангид алга');
  }
  const skills = averageBySkill(await this.studentSkillRows(studentId));
  const vocab = await this.vocabMastery(studentId);
  const submissions = await this.submissionRepo.find({
    where: { studentId },
    relations: ['assignment'],
    order: { submittedAt: 'DESC' },
    take: 50,
  });
  const student = roster.find((s) => s.id === studentId)!;
  return {
    studentId,
    fullName: student.fullName,
    xp: student.xp,
    currentStreak: student.currentStreak,
    skills: { ...skills, vocab },
    assignments: submissions.map((s) => ({
      assignmentId: s.assignmentId,
      type: s.assignment?.type ?? null,
      status: s.status,
      scorePct: s.scorePct,
      submittedAt: s.submittedAt,
    })),
  };
}
```

(`ClassesService.getStudents` returns `SafeUser[]` — confirm it includes `xp`/`currentStreak`; if not, load them via the users repo already available to ClassesService, or add a `select`. Keep the shape stable.)

- [ ] **Step 2: Controller**

```typescript
// backend/src/teacher/teacher.controller.ts
import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../common/enums';
import { User } from '../entities/user.entity';
import { ProgressService } from './progress.service';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class TeacherController {
  constructor(private readonly progress: ProgressService) {}

  @Get('classes/:id/students/:studentId/progress')
  studentProgress(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.progress.studentProgress(id, studentId, user);
  }
}
```

Register `TeacherController` in `teacher.module.ts` `controllers: [TeacherController]`.

- [ ] **Step 3: Verify + smoke test** — `npx tsc --noEmit`; GET as the class teacher → breakdown + assignment history; GET as a non-teacher → 403.

- [ ] **Step 4: Commit**

```bash
git add backend/src/teacher
git commit -m "feat(teacher): GET /classes/:id/students/:studentId/progress"
```

---

### Task 9: `GET /classes/:id/overview` (class analytics)

**Files:**
- Modify: `backend/src/teacher/progress.service.ts`
- Modify: `backend/src/teacher/teacher.controller.ts`

- [ ] **Step 1: Service method**

```typescript
async classOverview(classId: string, teacher: User) {
  const roster = await this.classes.getStudents(classId, teacher); // 403 guard
  const studentIds = roster.map((s) => s.id);
  // Class skill breakdown = average over all students' attempts.
  const rows = studentIds.length
    ? ((await this.attempts.find({
        where: { userId: In(studentIds) },
        select: { skill: true, scorePct: true },
      })) as { skill: string; scorePct: number }[])
    : [];
  const skills = averageBySkill(rows);
  const scored = SKILL_DIMENSIONS.filter((s) => skills[s] !== null);
  const weakestSkill =
    scored.length === 0
      ? null
      : scored.reduce((a, b) => (skills[a]! <= skills[b]! ? a : b));
  // Per-student completion % across their submissions.
  const subs = studentIds.length
    ? await this.submissionRepo.find({ where: { studentId: In(studentIds) } })
    : [];
  const perStudent = roster.map((s) => {
    const mine = subs.filter((x) => x.studentId === s.id);
    const done = mine.filter((x) => x.status !== 'assigned').length;
    return {
      studentId: s.id,
      fullName: s.fullName,
      completionPct: mine.length ? Math.round((done / mine.length) * 100) : null,
    };
  });
  return { studentCount: roster.length, skills, weakestSkill, students: perStudent };
}
```

Import `In` from `typeorm`.

- [ ] **Step 2: Controller route** (in `TeacherController`)

```typescript
@Get('classes/:id/overview')
classOverview(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
  return this.progress.classOverview(id, user);
}
```

- [ ] **Step 3: Verify + commit**

Run: `cd backend && npx tsc --noEmit`

```bash
git add backend/src/teacher
git commit -m "feat(teacher): GET /classes/:id/overview (skill breakdown + weakest skill + completion)"
```

---

### Task 10: `GET /teacher/dashboard`

**Files:**
- Modify: `backend/src/teacher/progress.service.ts`
- Modify: `backend/src/teacher/teacher.controller.ts`

- [ ] **Step 1: Service method** — aggregate across the teacher's classes.

```typescript
async dashboard(teacher: User) {
  const { teaching } = await this.classes.findForUser(teacher);
  const classIds = teaching.map((c) => c.id);
  if (classIds.length === 0) {
    return { classCount: 0, studentCount: 0, activeStudents: 0, pending: 0, overdue: 0, classes: [] };
  }
  const students = await this.classes.getStudentsForClasses(classIds); // see Step 2
  const studentIds = [...new Set(students.map((s) => s.id))];
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5);
  const activeStudents = studentIds.length
    ? await this.attempts
        .createQueryBuilder('a')
        .select('COUNT(DISTINCT a.user_id)', 'n')
        .where('a.user_id IN (:...ids)', { ids: studentIds })
        .andWhere('a.created_at >= :since', { since: sevenDaysAgo })
        .getRawOne<{ n: string }>()
        .then((r) => Number(r?.n ?? 0))
    : 0;
  const assignmentIds = (
    await this.assignmentRepo.find({ where: { classId: In(classIds) }, select: { id: true } })
  ).map((a) => a.id);
  const subs = assignmentIds.length
    ? await this.submissionRepo.find({ where: { assignmentId: In(assignmentIds) } })
    : [];
  const pending = subs.filter((s) => s.status === 'assigned').length;
  const overdue = subs.filter((s) => s.status === 'late').length;
  return {
    classCount: teaching.length,
    studentCount: studentIds.length,
    activeStudents,
    pending,
    overdue,
    classes: teaching.map((c) => ({ id: c.id, name: c.name })),
  };
}
```

- [ ] **Step 2: Add `getStudentsForClasses` to ClassesService** (a distinct-students helper, no per-class access check — the dashboard already filtered to the teacher's own classes):

```typescript
// classes.service.ts
async getStudentsForClasses(classIds: string[]): Promise<SafeUser[]> {
  if (!classIds.length) return [];
  const classes = await this.classes.find({
    where: { id: In(classIds) },
    relations: ['students'],
  });
  const map = new Map<string, User>();
  for (const c of classes) for (const s of c.students ?? []) map.set(s.id, s);
  return [...map.values()].map((u) => sanitizeUser(u));
}
```

(Confirm the `Class` ↔ students relation name; reuse the same one `getStudents` uses. Import `In`, `sanitizeUser` as that file already does.) Export it — `ClassesService` is already exported by `ClassesModule`.

- [ ] **Step 3: Controller route**

```typescript
@Get('teacher/dashboard')
dashboard(@CurrentUser() user: User) {
  return this.progress.dashboard(user);
}
```

- [ ] **Step 4: Verify + smoke test + commit**

Run: `cd backend && npx tsc --noEmit`; GET `/teacher/dashboard` as a teacher with ≥1 class.

```bash
git add backend/src/teacher backend/src/classes
git commit -m "feat(teacher): GET /teacher/dashboard (totals, active 7d, pending/overdue)"
```

---

## Phase D — Migration + docs

### Task 11: Production migration

**Files:**
- Create: `backend/src/migrations/1785600000000-TeacherPanelPhase1.ts`

- [ ] **Step 1: Write the migration** (prod runs `DB_SYNCHRONIZE=false`)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class TeacherPanelPhase11785600000000 implements MigrationInterface {
  name = 'TeacherPanelPhase11785600000000';

  public async up(q: QueryRunner): Promise<void> {
    // quiz_attempts
    await q.query(`CREATE TABLE "quiz_attempts" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "user_id" uuid NOT NULL,
      "quiz_id" uuid NOT NULL,
      "skill" character varying NOT NULL,
      "correct_count" integer NOT NULL DEFAULT 0,
      "total_count" integer NOT NULL DEFAULT 0,
      "score_pct" integer NOT NULL DEFAULT 0,
      "assignment_id" uuid,
      CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"))`);
    await q.query(`CREATE INDEX "IDX_qa_user_skill" ON "quiz_attempts" ("user_id","skill")`);
    await q.query(`CREATE INDEX "IDX_qa_user_created" ON "quiz_attempts" ("user_id","created_at")`);
    await q.query(`CREATE INDEX "IDX_qa_assignment" ON "quiz_attempts" ("assignment_id")`);
    await q.query(`ALTER TABLE "quiz_attempts" ADD CONSTRAINT "FK_qa_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE`);
    await q.query(`ALTER TABLE "quiz_attempts" ADD CONSTRAINT "FK_qa_quiz" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE`);

    // assignments: note + student_ids
    await q.query(`ALTER TABLE "assignments" ADD "note" character varying`);
    await q.query(`ALTER TABLE "assignments" ADD "student_ids" jsonb`);

    // assignment_completions → submission record
    await q.query(`CREATE TYPE "public"."assignment_completions_status_enum" AS ENUM('assigned','completed','late')`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "status" "public"."assignment_completions_status_enum" NOT NULL DEFAULT 'completed'`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "score_pct" integer`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "submitted_at" TIMESTAMP WITH TIME ZONE`);
    await q.query(`ALTER TABLE "assignment_completions" ADD "attempt_count" integer NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "attempt_count"`);
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "submitted_at"`);
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "score_pct"`);
    await q.query(`ALTER TABLE "assignment_completions" DROP COLUMN "status"`);
    await q.query(`DROP TYPE "public"."assignment_completions_status_enum"`);
    await q.query(`ALTER TABLE "assignments" DROP COLUMN "student_ids"`);
    await q.query(`ALTER TABLE "assignments" DROP COLUMN "note"`);
    await q.query(`DROP TABLE "quiz_attempts"`);
  }
}
```

- [ ] **Step 2: Dry-run against a scratch DB** (with `DB_SYNCHRONIZE=false`)

Run: `cd backend && npm run migration:run` (or the project's documented migration command in `package.json`)
Expected: migration applies cleanly; `\d quiz_attempts` shows the table.

- [ ] **Step 3: Commit**

```bash
git add backend/src/migrations/1785600000000-TeacherPanelPhase1.ts
git commit -m "chore(teacher): migration — quiz_attempts + assignment/submission columns"
```

---

### Task 12: Update `API.md`

**Files:**
- Modify: `backend/API.md`

- [ ] **Step 1: Document the new/changed endpoints** — add rows for:
  `POST /quizzes/:id/submit` (now accepts optional `assignmentId`), `POST /assignments` (now accepts `note`, `studentIds`), `GET /assignments/:id/submissions`, `GET /classes/:id/students/:studentId/progress`, `GET /classes/:id/overview`, `GET /teacher/dashboard` — each with path · auth/role · purpose · params, matching the file's existing table format, plus the mobile-usage column noting these are consumed by the (upcoming) teacher panel screens.

- [ ] **Step 2: Commit**

```bash
git add backend/API.md
git commit -m "docs(api): teacher panel phase 1 endpoints"
```

---

## Self-review notes (already reconciled)

- **Spec coverage:** foundation (Task 1–3), Assign 2.0 + submissions (Task 4–6), skill breakdown (Task 7), student progress (Task 8), class analytics (Task 9), dashboard (Task 10), migration (Task 11), docs (Task 12). Mobile UI + push = separate plan (out of scope here, by design).
- **Naming consistency:** `resolveSkill`, `recordAttempt`, `averageBySkill`, `SKILL_DIMENSIONS`, `vocabMastery`, `studentProgress`, `classOverview`, `dashboard`, `recordSubmission`, `submissionsFor` — used identically across tasks.
- **Vocab rule** matches the spec (`intervalDays >= 21`). **Skill dimensions** = listening/reading/writing/fill (+ vocab), Speaking deferred, `other` excluded — matches the spec.
- **Confirmed:** `Class.students` is a `@ManyToMany` via the `class_students` join table (use `relations: ['students']`); `SafeUser = Omit<User,'passwordHash'>` so it carries `xp`/`currentStreak`/`fullName`; migration command is `npm run migration:run` (`-d src/config/data-source.ts`).
- **Watch at execution:** guard the possible `Quizzes ↔ Assignments` module cycle with `forwardRef` on both sides (Task 5); `ClassesService.getStudents` must stay the access-checked path (throws 403 for non-teachers) while `getStudentsForClasses` is the unchecked bulk helper used only after the dashboard has filtered to the teacher's own classes.
