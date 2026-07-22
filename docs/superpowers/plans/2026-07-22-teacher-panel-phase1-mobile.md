# Teacher Panel 2.0 — Phase 1 Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the mobile teacher-panel screens that consume the Phase 1 backend — teacher dashboard, class analytics, per-student progress, Assign 2.0 (due date + student multi-select), and the student-side assignment list with due/status/score.

**Architecture:** New/extended API clients in `mobile/src/api/` wrap the Phase 1 endpoints; expo-router screens under `app/(teacher)/` compose existing shared components (`AppText`, `ClassCard`, `SectionHeader`, `EmptyState`, `Avatar`) using the established `useAuth()` + `useColors()` + `makeStyles(colors)` + i18n `t()` patterns. No new state library — screens fetch on focus like the current ones.

**Tech Stack:** React Native + Expo (expo-router), TypeScript. API via `apiRequest` in `src/api/client.ts`. No unit-test infra in `/mobile` — verify by running the app (Expo) and hitting a dev/prod backend.

**⚠️ Ownership:** `/mobile` is **Boju's** area (CLAUDE.md). This plan is a handoff. Land as small, announced PRs. Shared files (`theme.ts`, `i18n/index.ts`, `_layout.tsx`) → tiny PRs, announced first.

**Depends on:** backend PR #146 (Teacher Panel Phase 1) merged + prod migration `1785600000000` applied.

**Spec:** `docs/superpowers/specs/2026-07-22-teacher-panel-phase1-design.md` · **Endpoint reference:** `API.md` §16/§16a.

---

## Endpoint contracts (from the shipped backend)

- `GET /teacher/dashboard` → `{ classCount, studentCount, activeStudents, pending, overdue, classes: {id,name}[] }`
- `GET /classes/:id/overview` → `{ studentCount, skills: {listening,reading,writing,fill: number|null}, weakestSkill: string|null, students: {studentId, fullName, completionPct: number|null}[] }`
- `GET /classes/:id/students/:studentId/progress` → `{ studentId, fullName, xp, currentStreak, skills: {listening,reading,writing,fill,vocab: number|null}, assignments: {assignmentId, type, status, scorePct, submittedAt}[] }`
- `GET /assignments/:id/submissions` → `{ studentId, fullName, status, scorePct, submittedAt, attemptCount }[]`
- `POST /assignments` body now accepts `note?: string`, `studentIds?: string[]` (omit = whole class)
- `GET /assignments/mine` → each row now also has `status: 'assigned'|'completed'|'late'`, `scorePct: number|null`
- `POST /quizzes/:id/submit` body accepts optional `assignmentId` (link a quiz attempt to an assignment)

`status` enum values: `'assigned' | 'completed' | 'late'`.

---

## File structure

- Create `mobile/src/api/teacher.ts` — dashboard / class overview / student progress / submissions clients + types.
- Modify `mobile/src/api/assignments.ts` — `note`/`studentIds` on create input; `status`/`scorePct` on `Assignment`; submissions type.
- Create `mobile/src/components/SkillBars.tsx` — reusable skill-breakdown bar list (used by class + student screens).
- Create `mobile/src/components/StatusBadge.tsx` — assigned/completed/late pill (used by student list + submissions).
- Modify `app/(teacher)/index.tsx` — add a dashboard summary strip above the class list.
- Modify `app/(teacher)/class/[id].tsx` — add class overview (skill bars + weakest chip + per-student completion rows linking to student progress).
- Create `app/(teacher)/class/[id]/student/[studentId].tsx` — per-student progress screen.
- Modify `app/(teacher)/class/[id]/assign.tsx` — add due-date picker, note field, student multi-select.
- Modify `app/assignments.tsx` — show due date + StatusBadge + score per row.
- Modify `mobile/src/i18n/index.ts` — new keys (tiny PR, announce).

---

## Task 1: API client — `teacher.ts` + assignment types

**Files:**
- Create: `mobile/src/api/teacher.ts`
- Modify: `mobile/src/api/assignments.ts`

- [ ] **Step 1: Create `mobile/src/api/teacher.ts`**

```typescript
import { apiRequest } from './client';

export type SubmissionStatus = 'assigned' | 'completed' | 'late';

export interface TeacherDashboard {
  classCount: number;
  studentCount: number;
  activeStudents: number;
  pending: number;
  overdue: number;
  classes: { id: string; name: string }[];
}

/** null = no data for that skill (render as "—", not 0%). */
export interface SkillBreakdown {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  fill: number | null;
}

export interface ClassOverview {
  studentCount: number;
  skills: SkillBreakdown;
  weakestSkill: string | null;
  students: { studentId: string; fullName: string; completionPct: number | null }[];
}

export interface StudentProgress {
  studentId: string;
  fullName: string;
  xp: number;
  currentStreak: number;
  skills: SkillBreakdown & { vocab: number | null };
  assignments: {
    assignmentId: string;
    type: 'lesson' | 'quiz' | null;
    status: SubmissionStatus;
    scorePct: number | null;
    submittedAt: string | null;
  }[];
}

export interface Submission {
  studentId: string;
  fullName: string | null;
  status: SubmissionStatus;
  scorePct: number | null;
  submittedAt: string | null;
  attemptCount: number;
}

export function getTeacherDashboard(token: string): Promise<TeacherDashboard> {
  return apiRequest<TeacherDashboard>('/teacher/dashboard', { token });
}

export function getClassOverview(classId: string, token: string): Promise<ClassOverview> {
  return apiRequest<ClassOverview>(`/classes/${classId}/overview`, { token });
}

export function getStudentProgress(
  classId: string,
  studentId: string,
  token: string,
): Promise<StudentProgress> {
  return apiRequest<StudentProgress>(
    `/classes/${classId}/students/${studentId}/progress`,
    { token },
  );
}

export function getAssignmentSubmissions(
  assignmentId: string,
  token: string,
): Promise<Submission[]> {
  return apiRequest<Submission[]>(`/assignments/${assignmentId}/submissions`, { token });
}
```

- [ ] **Step 2: Extend `mobile/src/api/assignments.ts`** — add `status`/`scorePct` to the `Assignment` interface, and `note`/`studentIds` to `CreateAssignmentInput`:

```typescript
// import the shared status type
import type { SubmissionStatus } from './teacher';

// in Assignment interface, add:
  status?: SubmissionStatus; // present on /assignments/mine rows
  scorePct?: number | null;  // present on /assignments/mine rows

// in CreateAssignmentInput, add:
  note?: string;
  studentIds?: string[]; // omit = whole class
```

`createAssignment` already forwards the whole `input` object as the body, so no change to the function body is needed — the new optional fields flow through automatically.

- [ ] **Step 3: Typecheck**

Run: `cd mobile && npx tsc --noEmit`
Expected: no errors in `api/teacher.ts` or `api/assignments.ts`.

- [ ] **Step 4: Commit**

```bash
git add mobile/src/api/teacher.ts mobile/src/api/assignments.ts
git commit -m "feat(mobile): teacher panel API clients (dashboard/overview/progress/submissions)"
```

---

## Task 2: Shared components — `SkillBars` + `StatusBadge`

**Files:**
- Create: `mobile/src/components/SkillBars.tsx`
- Create: `mobile/src/components/StatusBadge.tsx`

- [ ] **Step 1: `StatusBadge.tsx`** — a small pill mirroring the app's badge style. Read an existing badge-like component first (e.g. how `ClassCard` renders its join-code pill) to match tokens. Implementation:

```typescript
import { View, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { radius, spacing, type AppColors } from '../theme/theme';
import { t } from '../i18n';
import type { SubmissionStatus } from '../api/teacher';

const COLOR_KEY: Record<SubmissionStatus, keyof AppColors> = {
  assigned: 'textMuted',
  completed: 'success',
  late: 'danger',
};

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  const c = colors[COLOR_KEY[status]] as string;
  return (
    <View style={[styles.pill, { backgroundColor: c + '22' }]}>
      <AppText variant="label" color={c}>{t(`submissionStatus_${status}`)}</AppText>
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  pill: { alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
});
```

⚠️ Confirm the real token names in `theme.ts` (`success`/`danger`/`textMuted` may be named differently, e.g. `error`/`green`). Use the actual names; do NOT invent tokens.

- [ ] **Step 2: `SkillBars.tsx`** — renders a labelled horizontal bar per skill; `null` value → "—" and an empty track.

```typescript
import { View, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { radius, spacing, type AppColors } from '../theme/theme';
import { t } from '../i18n';

export interface SkillRow { key: string; value: number | null }

export function SkillBars({ rows }: { rows: SkillRow[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <AppText variant="label" style={styles.label}>{t(`skill_${r.key}`)}</AppText>
          <View style={styles.track}>
            {r.value != null && (
              <View style={[styles.fill, { width: `${r.value}%` }]} />
            )}
          </View>
          <AppText variant="label" style={styles.val}>{r.value == null ? '—' : `${r.value}%`}</AppText>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { width: 68 },
  track: { flex: 1, height: 8, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.full, backgroundColor: colors.primary },
  val: { width: 44, textAlign: 'right' },
});
```

⚠️ Confirm `colors.border`/`colors.primary`/`AppText` `style` prop exist (they're used across the app — verify against one screen). Adjust to real tokens.

- [ ] **Step 3: Typecheck + commit**

```bash
cd mobile && npx tsc --noEmit
git add mobile/src/components/SkillBars.tsx mobile/src/components/StatusBadge.tsx
git commit -m "feat(mobile): SkillBars + StatusBadge shared components"
```

---

## Task 3: i18n keys (tiny PR — announce first)

**Files:**
- Modify: `mobile/src/i18n/index.ts`

- [ ] **Step 1:** Add keys (Mongolian primary), following the file's existing shape. Needed keys:
  `skill_listening` "Сонсгол", `skill_reading` "Унших", `skill_writing` "Бичих", `skill_fill` "Нөхөх", `skill_vocab` "Үгсийн сан",
  `submissionStatus_assigned` "Хийгээгүй", `submissionStatus_completed` "Хийсэн", `submissionStatus_late` "Хоцорсон",
  `weakestSkill` "Хамгийн сул", `activeStudents` "Идэвхтэй", `pendingTasks` "Хүлээгдэж буй", `overdueTasks` "Хоцорсон",
  `avgProgress` "Дундаж ахиц", `studentProgress` "Сурагчийн ахиц", `assignTo` "Хэнд оноох", `wholeClass` "Бүх анги",
  `selectStudents` "Сурагч сонгох", `dueDate` "Дуусах хугацаа", `note` "Тэмдэглэл".

- [ ] **Step 2: Commit**

```bash
git add mobile/src/i18n/index.ts
git commit -m "chore(mobile): i18n keys for teacher panel phase 1"
```

---

## Task 4: Dashboard strip on `(teacher)/index.tsx`

**Files:**
- Modify: `mobile/app/(teacher)/index.tsx`

- [ ] **Step 1:** Fetch the dashboard alongside classes. In `load()` add
  `const dash = await getTeacherDashboard(token); setDash(dash);` (import `getTeacherDashboard`, add `const [dash, setDash] = useState<TeacherDashboard | null>(null)`). Guard failures like the existing try/catch.

- [ ] **Step 2:** Render a 3-stat strip under the gradient hero (before the class list): **Сурагч** (`dash.studentCount`), **Идэвхтэй** (`dash.activeStudents`, `t('activeStudents')`), **Хүлээгдэж буй** (`dash.pending`, `t('pendingTasks')`). Use small stat cards; reuse the hero's chip/card style tokens already in `makeStyles`. Only render when `dash` is non-null.

- [ ] **Step 3: Verify in the app** — run Expo, open the teacher tab, confirm the strip shows real counts and the class list still works. `npx tsc --noEmit` clean.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/(teacher)/index.tsx
git commit -m "feat(mobile): teacher dashboard summary strip"
```

---

## Task 5: Class overview on `class/[id].tsx`

**Files:**
- Modify: `mobile/app/(teacher)/class/[id].tsx`

- [ ] **Step 1:** Read the file first (362 lines) to find where the roster/assignments render. Add a fetch of `getClassOverview(id, token)` on focus into an `overview` state (guard failures).

- [ ] **Step 2:** Render, above or beside the roster: a **SkillBars** block built from `overview.skills`
  (`rows = ['listening','reading','writing','fill'].map(k => ({ key: k, value: overview.skills[k] }))`), and a "weakest skill" chip when `overview.weakestSkill` is set (`t('weakestSkill')` + `t('skill_'+weakestSkill)`).

- [ ] **Step 3:** For each roster row, show the student's `completionPct` (from `overview.students`) and make the row navigate to the student progress screen:
  `router.push(`/(teacher)/class/${id}/student/${studentId}`)`. Match the existing roster row component/style in the file.

- [ ] **Step 4: Verify in the app** + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(teacher)/class/[id].tsx
git commit -m "feat(mobile): class overview (skill bars + weakest + per-student completion)"
```

---

## Task 6: Student progress screen

**Files:**
- Create: `mobile/app/(teacher)/class/[id]/student/[studentId].tsx`

- [ ] **Step 1:** New expo-router screen. Read `useLocalSearchParams<{ id: string; studentId: string }>()`, `useAuth()` for token, fetch `getStudentProgress(id, studentId, token)` on focus into state with a loading spinner (mirror the `(teacher)/index.tsx` loading pattern).

- [ ] **Step 2:** Render:
  - Header: `fullName`, `xp` (⭐), `currentStreak` (🔥) — reuse `Avatar` + `AppText`.
  - **SkillBars** from `skills` including vocab: `rows = ['listening','reading','writing','fill','vocab'].map(k => ({ key: k, value: skills[k] }))`.
  - Assignment history list: each item shows the assignment `type`, a **StatusBadge** (`status`), and `scorePct` when non-null. Empty → `EmptyState`.

- [ ] **Step 3: Verify in the app** (navigate from a class roster row) + `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(teacher)/class/[id]/student/[studentId].tsx"
git commit -m "feat(mobile): per-student progress screen"
```

---

## Task 7: Assign 2.0 — due date + note + student multi-select

**Files:**
- Modify: `mobile/app/(teacher)/class/[id]/assign.tsx`

- [ ] **Step 1:** Read the file (195 lines) to see the current content-picker + `createAssignment` call. Add local state: `dueAt?: string`, `note: string`, `targetMode: 'all' | 'select'`, `selectedIds: string[]`.

- [ ] **Step 2:** UI additions above the submit button:
  - **Note** — a `TextInput` bound to `note` (`t('note')`).
  - **Due date** — a date picker. Use the app's existing date-picker approach if one exists (grep for `DateTimePicker`/`@react-native-community/datetimepicker`); if none exists, this is a new dependency → **announce before adding**. Store ISO string in `dueAt`.
  - **Assign to** — a segmented toggle `t('wholeClass')` / `t('selectStudents')`. When `select`, list the class roster (fetch via `classesApi.getClassStudents(id, token)`) with tappable checkboxes populating `selectedIds`.

- [ ] **Step 3:** Pass the new fields into `createAssignment({ ..., note: note || undefined, dueAt, studentIds: targetMode === 'select' ? selectedIds : undefined }, token)`. Block submit when `select` mode has zero students.

- [ ] **Step 4: Verify in the app** — assign to whole class and to a subset; confirm backend accepts both + `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add "mobile/app/(teacher)/class/[id]/assign.tsx"
git commit -m "feat(mobile): Assign 2.0 — due date, note, student multi-select"
```

---

## Task 8: Student assignment list — due/status/score

**Files:**
- Modify: `mobile/app/assignments.tsx`

- [ ] **Step 1:** Read the file (125 lines). The `getMyAssignments` rows now carry `status` + `scorePct` (from Task 1's type change) and already carry `dueAt`.

- [ ] **Step 2:** On each row render: the due date (format like other dates in the app — grep for an existing date formatter/helper), a **StatusBadge** (`row.status ?? 'assigned'`), and the score when `row.scorePct != null` (e.g. `${scorePct}%`). Keep the existing tap/target-resolution behavior.

- [ ] **Step 3: Verify in the app** + `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add mobile/app/assignments.tsx
git commit -m "feat(mobile): student assignment list shows due/status/score"
```

---

## Deferred / out of scope

- **New-assignment push notification** (spec's student-side bullet) — depends on the push pipeline (`docs/PUSH_NOTIFICATIONS_PLAN.md`, ROADMAP Update 1). Do NOT build here; wire it when push lands.
- **Submissions detail screen** (`GET /assignments/:id/submissions`) — the client is added in Task 1 and the class overview already surfaces per-student completion; a dedicated per-assignment submissions screen can follow if the teacher flow needs it. Not required for Phase 1.

## Self-review notes

- **Spec coverage:** Dashboard (Task 4), Class Detail w/ skill breakdown + weakest + completion (Task 5), Student Progress (Task 6), Assign 2.0 multi-select (Task 7), student list due/status/score (Task 8). Push deferred with a reason.
- **No unit tests:** `/mobile` has no test infra; each task verifies by running the Expo app against a backend — called out per task.
- **Token/type consistency:** `SubmissionStatus` defined once in `api/teacher.ts` and imported by `assignments.ts`, `StatusBadge`, screens. Skill keys `listening/reading/writing/fill/vocab` consistent across `SkillBars`, i18n, and screen row-builders.
- **⚠️ Execution guards:** verify real theme token names before using `success`/`danger`/`border` (Task 2); verify an existing date-picker before adding a dependency (Task 7); all shared-file edits (`i18n`, any `theme.ts`) are tiny announced PRs per CLAUDE.md.
