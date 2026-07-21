# IELTS Admin Authoring — Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin "IELTS" section so non-developers can author IELTS content (4 modules) into the existing `Quiz` model that Plan 1 already supports.

**Architecture:** A new `IeltsPage.tsx` modeled on the existing `ExercisesPage.tsx` — a module-tabbed authoring page that creates `Quiz` rows with `category = ielts_<module>`. Reading adds a `passageText`, Listening adds an `audioUrl`, Writing/Speaking use the new `open_response` question type (added to the shared `QuizQuestionsEditor`). Listening/Reading keep the existing mc/fill/word_match types.

**Tech Stack:** React + TypeScript (Vite) admin, `react-router-dom`, shared components (`Table`/`Modal`/`Select`/`Input`/`Pagination`/`RowActions`/`Badge`/`PageHeader`/`FormActions`), `api` client. Follows `CODING_RULES.md §4` (reuse shared components, `api.*` only, options in `options.ts`).

> **Verification note:** the admin app has **no test runner**. Verify each task with **`cd admin && npx tsc -b`** (typecheck; must succeed) and the final task with **`npm run build`** (`tsc -b && vite build`). Do NOT add a test framework.

> **Scope:** Plan **2 of 3** for IELTS Phase 1, per `docs/superpowers/specs/2026-07-21-ielts-vertical-design.md`. Depends on **Plan 1 (backend)** — already merged to `main` (columns `passage_text`/`audio_url`, `open_response` type, `ielts_*` categories, band on submit). Plan 3 = mobile.

> **Branch:** `feature/ielts-admin` (already created off `main`). Never commit on `main`. Every commit message ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

> **MVP scope:** IeltsPage supports create/edit/list/publish-toggle/delete + bulk publish/delete. **CSV/JSON import is intentionally OUT** for MVP (open_response doesn't map to CSV cleanly; keeps the page lean). Audio/image are **URL text inputs** (paste a Cloudinary/R2 URL) — no upload widget in this plan.

---

## File Structure

| File | Responsibility | Create/Modify |
| --- | --- | --- |
| `admin/src/components/QuizQuestionsEditor.tsx` | Add `open_response` question type + `OREditor` | Modify |
| `admin/src/lib/options.ts` | `IELTS_MODULES` + `ieltsSubTopicOptions(module)` | Modify |
| `admin/src/pages/ielts/IeltsPage.tsx` | The IELTS authoring page (4 module tabs) | **Create** |
| `admin/src/App.tsx` | Add `/ielts` route | Modify |
| `admin/src/components/Sidebar.tsx` | Add "IELTS" nav item | Modify |

---

## Task 1: Add `open_response` to the shared QuizQuestionsEditor

**Files:**
- Modify: `admin/src/components/QuizQuestionsEditor.tsx`

- [ ] **Step 1: Add the ORQuestion type + blank + union**

In `admin/src/components/QuizQuestionsEditor.tsx`, after the `WMQuestion` interface (line ~22), add:

```ts
export interface ORQuestion {
  type: 'open_response';
  prompt: string;
  modelAnswer: string;
  imageUrl?: string;   // Writing Task 1 chart/graph (optional)
  bandNote?: string;   // band descriptor / guidance (optional)
}
```

Change the `Question` union and `QuestionType` to include open_response:

```ts
export type Question = MCQuestion | FBQuestion | WMQuestion | ORQuestion;

/** The underlying question format. */
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'word_match' | 'open_response';
```

Add a blank factory after `blankWM()`:

```ts
export function blankOR(): ORQuestion {
  return { type: 'open_response', prompt: '', modelAnswer: '' };
}
```

Update `blankQuestion`:

```ts
export function blankQuestion(t: QuestionType): Question {
  if (t === 'fill_blank') return blankFB();
  if (t === 'word_match') return blankWM();
  if (t === 'open_response') return blankOR();
  return blankMC();
}
```

- [ ] **Step 2: Add the OREditor component**

Add this component after `WMEditor` (before `PointsInput`):

```tsx
function OREditor({ q, idx, onChange, onRemove }: {
  q: ORQuestion; idx: number; onChange: (q: ORQuestion) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-purple-100 bg-purple-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">#{idx + 1} · Нээлттэй хариулт</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
      </div>
      <textarea
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        rows={3} placeholder="Даалгавар / асуулт (prompt)..."
        value={q.prompt}
        onChange={(e) => onChange({ ...q, prompt: e.target.value })}
      />
      <input
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        placeholder="Зураг URL (Writing Task 1 график — заавал биш)"
        value={q.imageUrl ?? ''}
        onChange={(e) => onChange({ ...q, imageUrl: e.target.value })}
      />
      <textarea
        className="w-full rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-sm focus:outline-none"
        rows={4} placeholder="Жишиг хариулт (model answer) — сурагч өөрөө харьцуулна"
        value={q.modelAnswer}
        onChange={(e) => onChange({ ...q, modelAnswer: e.target.value })}
      />
      <input
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        placeholder="Band тайлбар / зөвлөмж (заавал биш)"
        value={q.bandNote ?? ''}
        onChange={(e) => onChange({ ...q, bandNote: e.target.value })}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire OREditor into the list editor**

In `QuizQuestionsEditor`, update the render map so open_response renders `OREditor`. Replace the existing ternary in the `questions.map(...)` with:

```tsx
      {questions.map((q, i) =>
        q.type === 'multiple_choice' ? (
          <MCEditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ) : q.type === 'fill_blank' ? (
          <FBEditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ) : q.type === 'word_match' ? (
          <WMEditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ) : (
          <OREditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ),
      )}
```

- [ ] **Step 4: Typecheck**

Run: `cd admin && npx tsc -b`
Expected: succeeds (no errors). If `update(i, nq)` complains about types, confirm `Question` union includes `ORQuestion`.

- [ ] **Step 5: Commit**

```bash
git add admin/src/components/QuizQuestionsEditor.tsx
git commit -m "feat(ielts-admin): open_response question type in QuizQuestionsEditor"
```

---

## Task 2: IELTS module + sub-topic options

**Files:**
- Modify: `admin/src/lib/options.ts`

- [ ] **Step 1: Add IELTS options**

Append to `admin/src/lib/options.ts`:

```ts
/**
 * IELTS modules → Quiz `category` value. Objective modules (listening/reading)
 * are auto-scored to a band; writing/speaking are self-study (open_response).
 */
export const IELTS_MODULES = [
  { key: 'listening', label: 'Listening', category: 'ielts_listening', objective: true },
  { key: 'reading', label: 'Reading', category: 'ielts_reading', objective: true },
  { key: 'writing', label: 'Writing', category: 'ielts_writing', objective: false },
  { key: 'speaking', label: 'Speaking', category: 'ielts_speaking', objective: false },
] as const;

/** Free-text сэдэв suggestions per IELTS module (stored value = label). */
const IELTS_SUBTOPICS: Record<string, string[]> = {
  listening: ['Section 1', 'Section 2', 'Section 3', 'Section 4', 'Сорил'],
  reading: ['Academic', 'General Training', 'True/False/NG', 'Matching headings', 'Сорил'],
  writing: ['Task 1 (Academic)', 'Task 1 (General)', 'Task 2 (Essay)'],
  speaking: ['Part 1', 'Part 2 (Cue card)', 'Part 3'],
};

/** Сэдэв <select> options for one IELTS module's form (incl. empty option). */
export function ieltsSubTopicOptions(moduleKey: string) {
  return [
    { value: '', label: 'Сэдэвгүй' },
    ...(IELTS_SUBTOPICS[moduleKey] ?? []).map((v) => ({ value: v, label: v })),
  ];
}
```

- [ ] **Step 2: Typecheck**

Run: `cd admin && npx tsc -b`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add admin/src/lib/options.ts
git commit -m "feat(ielts-admin): IELTS module + sub-topic options"
```

---

## Task 3: Create IeltsPage

**Files:**
- Create: `admin/src/pages/ielts/IeltsPage.tsx`

This page is modeled on `admin/src/pages/exercises/ExercisesPage.tsx`. **Duplicate that file** as the starting point, then apply the exact changes below.

- [ ] **Step 1: Duplicate ExercisesPage as IeltsPage**

```bash
mkdir -p admin/src/pages/ielts
cp admin/src/pages/exercises/ExercisesPage.tsx admin/src/pages/ielts/IeltsPage.tsx
```

- [ ] **Step 2: Apply these exact changes to `admin/src/pages/ielts/IeltsPage.tsx`**

**(a) Imports** — replace the options import and add `IELTS_MODULES`, `ieltsSubTopicOptions`; keep `levelFormOptions`. Remove the `ReadingPage` import and the `Upload` icon import (no import feature). Import `blankQuestion` too:

```ts
import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, EyeOff, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';
import { Pagination } from '../../components/Pagination';
import { levelFormOptions as LEVEL_OPTIONS, IELTS_MODULES, ieltsSubTopicOptions } from '../../lib/options';
import {
  QuizQuestionsEditor,
  type Question,
  type QuestionType,
} from '../../components/QuizQuestionsEditor';
```

**(b) Component name + tabs** — rename the default export to `IeltsPage`, replace `CATS` with the IELTS modules, and default the tab to `'listening'`:

```ts
const LIMIT = 20;

const QTYPE_OPTIONS = [
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'fill_blank', label: 'Gap-fill' },
  { value: 'word_match', label: 'Matching' },
];

export default function IeltsPage() {
  const [mod, setMod] = useState<string>('listening');
  // ...
```

Everywhere the old file used `cat` for the current tab, use `mod`. Everywhere it used `CATS`, use `IELTS_MODULES` (whose items are `{ key, label, category, objective }`). The current module object:
```ts
const current = IELTS_MODULES.find((m) => m.key === mod)!;
```

**(c) Form type** — add `passageText`, `audioUrl` to `Form` and `emptyForm`:

```ts
interface Form {
  title: string; level: string; topic: string;
  questionType: QuestionType; questions: Question[];
  xpReward: number; isPublished: boolean;
  passageText: string; audioUrl: string;
}
const emptyForm: Form = {
  title: '', level: 'a1', topic: '', questionType: 'multiple_choice', questions: [],
  xpReward: 50, isPublished: false, passageText: '', audioUrl: '',
};
```

Add `passageText`/`audioUrl` to the `Exercise` interface too:
```ts
  passageText: string | null;
  audioUrl: string | null;
```

**(d) Question type per module** — Writing/Speaking force `open_response`; Listening/Reading use the selector. In `openCreate`, set the default type from the module:

```ts
  function defaultType(): QuestionType {
    return current.objective ? 'multiple_choice' : 'open_response';
  }
  function openCreate() {
    setForm({ ...emptyForm, questionType: defaultType() });
    setEditing(null); setError(''); setModal('create');
  }
```

In `openEdit`, populate `passageText`/`audioUrl`:
```ts
  function openEdit(ex: Exercise) {
    const qt = (ex.quizType as QuestionType) || (ex.questions[0]?.type ?? defaultType());
    setForm({
      title: ex.title, level: ex.level, topic: ex.topic ?? '', questionType: qt,
      questions: ex.questions ?? [], xpReward: ex.xpReward, isPublished: ex.isPublished,
      passageText: ex.passageText ?? '', audioUrl: ex.audioUrl ?? '',
    });
    setEditing(ex); setError(''); setModal('edit');
  }
```

**(e) load()** — use the module's category; drop the `speaking`/`reading` special-casing (all four modules list normally):

```ts
  const load = useCallback(async () => {
    const data = await api.get<{ items: Exercise[] }>(
      `/quizzes?category=${current.category}&limit=200`,
    );
    setItems(data.items ?? []);
    setSelected(new Set());
  }, [current.category]);
  useEffect(() => { load(); }, [load]);
```

**(f) save()** — send `category` from the module + `passageText`/`audioUrl`:

```ts
  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    if (form.questions.length === 0) { setError('Дор хаяж нэг асуулт нэмнэ үү'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(), level: form.level,
        category: current.category, topic: form.topic,
        quizType: form.questionType, questions: form.questions,
        xpReward: form.xpReward, isPublished: form.isPublished,
        passageText: current.key === 'reading' ? form.passageText : undefined,
        audioUrl: current.key === 'listening' ? form.audioUrl : undefined,
      };
      if (modal === 'create') await api.post('/quizzes', payload);
      else if (editing) await api.patch(`/quizzes/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }
```

**(g) Remove the entire CSV/JSON import feature** — delete `parseQuestions`, `runImport`, all `imp*` state, `importOpen` state, the "Импорт" button in the header, and the import `<Modal>` at the bottom.

**(h) Tabs render** — replace the `CATS.map` tab bar with `IELTS_MODULES.map` (use `m.key`/`m.label`), and remove the `speaking`/`reading` conditional blocks so the `<Table>` + `<Pagination>` always render:

```tsx
      <div className="mb-4 flex flex-wrap gap-2">
        {IELTS_MODULES.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMod(m.key); setPage(1); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${mod === m.key ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">{selected.size} сонгосон:</span>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(true)}>Нийтлэх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(false)}>Ноорог болгох</Button>
          <Button variant="danger" size="sm" onClick={bulkDelete}><Trash2 className="h-4 w-4" /> Устгах</Button>
        </div>
      )}

      <Table columns={columns} rows={paged} keyFn={(e) => e.id} empty="Контент байхгүй" />
      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
```

Header action becomes just the add button:
```tsx
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> IELTS контент нэмэх</Button>}
```
And `PageHeader` title/description:
```tsx
        title="IELTS"
        description="IELTS бэлтгэл — Listening / Reading (band) · Writing / Speaking (жишиг хариулт)"
```

**(i) The create/edit Modal form** — add module-specific fields and gate the question-type selector:

```tsx
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select label="Сэдэв" options={ieltsSubTopicOptions(mod)} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />

            {current.key === 'reading' && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reading passage</label>
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  rows={6} value={form.passageText}
                  onChange={(e) => setForm({ ...form, passageText: e.target.value })}
                  placeholder="Уншлагын эх бичвэр..."
                />
              </div>
            )}
            {current.key === 'listening' && (
              <Input label="Аудио URL" value={form.audioUrl} onChange={(e) => setForm({ ...form, audioUrl: e.target.value })} placeholder="https://.../section.mp3" />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select label="Түвшин" options={LEVEL_OPTIONS} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              {current.objective ? (
                <Select label="Асуултын төрөл" options={QTYPE_OPTIONS} value={form.questionType} onChange={(e) => changeType(e.target.value as QuestionType)} />
              ) : (
                <Input label="Формат" value="Нээлттэй хариулт" disabled />
              )}
              <Input label="XP шагнал" type="number" min={0} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {current.objective ? 'Асуултууд' : 'Даалгавар (Writing/Speaking)'} ({form.questions.length})
              </label>
              <QuizQuestionsEditor
                questionType={form.questionType}
                questions={form.questions}
                onChange={(questions) => setForm({ ...form, questions })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Шууд нийтлэх
            </label>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving} />
          </div>
```

Keep `changeType` as-is (it resets questions to the selected type). Note: `Input` must support a `disabled` prop — if it does not, use a plain read-only styled div instead; check `admin/src/components/Input.tsx` first.

- [ ] **Step 3: Typecheck**

Run: `cd admin && npx tsc -b`
Expected: succeeds. Fix any leftover references to the removed `cat`/`CATS`/import state.

- [ ] **Step 4: Commit**

```bash
git add admin/src/pages/ielts/IeltsPage.tsx
git commit -m "feat(ielts-admin): IeltsPage — 4 module tabs, passage/audio/open_response authoring"
```

---

## Task 4: Register route + nav

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/components/Sidebar.tsx`

- [ ] **Step 1: Add the route in App.tsx**

Add the import near the other page imports:
```ts
import IeltsPage from './pages/ielts/IeltsPage';
```
Add the route inside the `<Route element={<Layout/>}>` group (next to `/exercises`):
```tsx
            <Route path="/ielts"         element={<IeltsPage />} />
```

- [ ] **Step 2: Add the nav item in Sidebar.tsx**

Import an icon (add to the existing `lucide-react` import): `Award`.
Add to the `nav` array, right after the `/quizzes` entry:
```ts
  { to: '/ielts',         label: 'IELTS',         icon: Award },
```

- [ ] **Step 3: Build (typecheck + vite)**

Run: `cd admin && npm run build`
Expected: `tsc -b` passes and `vite build` completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add admin/src/App.tsx admin/src/components/Sidebar.tsx
git commit -m "feat(ielts-admin): add /ielts route + sidebar nav"
```

---

## Self-Review Checklist (before execution handoff)

- [ ] `npx tsc -b` clean after each task; `npm run build` clean at the end.
- [ ] `open_response` questions have NO `points` field (backend forces 0); OREditor doesn't render a points input.
- [ ] `passageText` only sent for Reading; `audioUrl` only for Listening (undefined otherwise → not overwritten).
- [ ] Writing/Speaking tabs force `open_response`; Listening/Reading show the mc/fill/word_match selector.
- [ ] No leftover `cat`/`CATS`/CSV-import references in IeltsPage.
- [ ] Category values exactly `ielts_listening|reading|writing|speaking` (match backend `IELTS_CATEGORIES`).

## Next (not in this plan)

- **Plan 3 — Mobile IELTS hub + runner + W/S practice** (assign Choi/Boju). Mobile owner assigned first.
- Optional later: audio/image upload widget (instead of URL), CSV import for L/R.
