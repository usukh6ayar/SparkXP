import { Plus, GripVertical, X } from 'lucide-react';

// ── Question types (shared by Quiz builder, lesson tests, Дасгал) ────────────

/**
 * IELTS exam part a question belongs to (1–4). Only the IELTS page sets it;
 * everywhere else it stays undefined and the app renders one undivided part.
 */
export interface Sectioned {
  section?: number;
}

export interface MCQuestion extends Sectioned {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correct: number;
  points: number;
}
export interface FBQuestion extends Sectioned {
  type: 'fill_blank';
  question: string;
  answer: string;
  points: number;
}
export interface WMQuestion extends Sectioned {
  type: 'word_match';
  pairs: { left: string; right: string }[];
  points: number;
}
export interface ORQuestion extends Sectioned {
  type: 'open_response';
  prompt: string;
  modelAnswer: string;
  imageUrl?: string;   // Writing Task 1 chart/graph (optional)
  bandNote?: string;   // band descriptor / guidance (optional)
}
export type Question = MCQuestion | FBQuestion | WMQuestion | ORQuestion;

/** The underlying question format. */
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'word_match' | 'open_response';

export function blankMC(): MCQuestion {
  return { type: 'multiple_choice', question: '', options: ['', '', '', ''], correct: 0, points: 10 };
}
export function blankFB(): FBQuestion {
  return { type: 'fill_blank', question: '', answer: '', points: 10 };
}
export function blankWM(): WMQuestion {
  return { type: 'word_match', pairs: [{ left: '', right: '' }, { left: '', right: '' }], points: 10 };
}
export function blankOR(): ORQuestion {
  return { type: 'open_response', prompt: '', modelAnswer: '' };
}
export function blankQuestion(t: QuestionType): Question {
  if (t === 'fill_blank') return blankFB();
  if (t === 'word_match') return blankWM();
  if (t === 'open_response') return blankOR();
  return blankMC();
}

// ── Per-type editors ─────────────────────────────────────────────────────────

function MCEditor({ q, idx, onChange, onRemove }: {
  q: MCQuestion; idx: number; onChange: (q: MCQuestion) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">#{idx + 1} · Олон сонголт</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
      </div>
      <input
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        placeholder="Асуулт бичнэ үү..."
        value={q.question}
        onChange={(e) => onChange({ ...q, question: e.target.value })}
      />
      <div className="space-y-2">
        {q.options.map((opt, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <input
              type="radio" name={`correct-${idx}`} checked={q.correct === oi}
              onChange={() => onChange({ ...q, correct: oi })}
              className="accent-primary shrink-0" title="Зөв хариулт"
            />
            <input
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${q.correct === oi ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}
              placeholder={`${oi + 1}-р сонголт`}
              value={opt}
              onChange={(e) => { const opts = [...q.options]; opts[oi] = e.target.value; onChange({ ...q, options: opts }); }}
            />
          </div>
        ))}
        <p className="text-xs text-gray-400">☝️ Радио товч дарж зөв хариултыг тэмдэглэнэ</p>
      </div>
      <PointsInput value={q.points} onChange={(p) => onChange({ ...q, points: p })} />
    </div>
  );
}

function FBEditor({ q, idx, onChange, onRemove }: {
  q: FBQuestion; idx: number; onChange: (q: FBQuestion) => void; onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-green-100 bg-green-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">#{idx + 1} · Нөхөх</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
      </div>
      <div>
        <input
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
          placeholder="Өгүүлбэр (жишээ: She ___ to school every day.)"
          value={q.question}
          onChange={(e) => onChange({ ...q, question: e.target.value })}
        />
        <p className="text-xs text-gray-400 mt-1">___ хоосон зайг нөхөнө гэж илэрхийлнэ</p>
      </div>
      <input
        className="w-full rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm focus:outline-none font-medium"
        placeholder="Зөв хариулт (жишээ: goes)"
        value={q.answer}
        onChange={(e) => onChange({ ...q, answer: e.target.value })}
      />
      <PointsInput value={q.points} onChange={(p) => onChange({ ...q, points: p })} />
    </div>
  );
}

function WMEditor({ q, idx, onChange, onRemove }: {
  q: WMQuestion; idx: number; onChange: (q: WMQuestion) => void; onRemove: () => void;
}) {
  function updatePair(pi: number, side: 'left' | 'right', val: string) {
    onChange({ ...q, pairs: q.pairs.map((p, i) => (i === pi ? { ...p, [side]: val } : p)) });
  }
  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">#{idx + 1} · Үг буудах</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400"><X className="h-4 w-4" /></button>
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-500 px-1">
          <span>Англи үг</span><span>Монгол утга</span>
        </div>
        {q.pairs.map((pair, pi) => (
          <div key={pi} className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1">
              <input className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none" placeholder="apple" value={pair.left} onChange={(e) => updatePair(pi, 'left', e.target.value)} />
              <input className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm focus:outline-none" placeholder="алим" value={pair.right} onChange={(e) => updatePair(pi, 'right', e.target.value)} />
            </div>
            <button onClick={() => onChange({ ...q, pairs: q.pairs.filter((_, i) => i !== pi) })} disabled={q.pairs.length <= 2} className="text-gray-300 hover:text-red-400 disabled:opacity-20"><X className="h-4 w-4" /></button>
          </div>
        ))}
        <button onClick={() => onChange({ ...q, pairs: [...q.pairs, { left: '', right: '' }] })} className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium">
          <Plus className="h-3 w-3" /> Хос нэмэх
        </button>
      </div>
      <PointsInput value={q.points} onChange={(p) => onChange({ ...q, points: p })} />
    </div>
  );
}

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

function PointsInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-gray-500 shrink-0">Оноо:</label>
      <input
        type="number" min={1}
        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none"
        value={value}
        onChange={(e) => onChange(Math.max(1, Number(e.target.value)))}
      />
    </div>
  );
}

// ── The list editor ──────────────────────────────────────────────────────────

interface Props {
  /** Which blank question to add with the "+ Асуулт нэмэх" button. */
  questionType: QuestionType;
  questions: Question[];
  onChange: (questions: Question[]) => void;
  /**
   * IELTS only: how many exam parts this module has (Listening 4 · Reading 3 ·
   * Writing 2 · Speaking 3). Given, the editor lays out exactly that many
   * blocks. Omitted everywhere else — a Дасгал or lesson test is one flat list.
   */
  parts?: number;
  /** What a part is called in this module: Section · Passage · Task · Part. */
  partLabel?: string;
}

/**
 * Reusable quiz/test question builder: renders each question in its type editor
 * and an "add question" button. Used by the Quiz page, lesson tests, and Дасгал.
 *
 * With `parts` given (IELTS) it switches to a part-by-part layout instead —
 * see `SectionedEditor`.
 */
export function QuizQuestionsEditor({
  questionType, questions, onChange, parts, partLabel,
}: Props) {
  if (parts && parts > 1) {
    return (
      <SectionedEditor
        questionType={questionType}
        questions={questions}
        onChange={onChange}
        parts={parts}
        partLabel={partLabel ?? 'Section'}
      />
    );
  }

  function update(i: number, q: Question) {
    onChange(questions.map((x, idx) => (idx === i ? q : x)));
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <QuestionEditor
          key={i}
          q={q}
          idx={i}
          onChange={(nq) => update(i, nq)}
          onRemove={() => remove(i)}
        />
      ))}
      <AddButton onClick={() => onChange([...questions, blankQuestion(questionType)])} />
    </div>
  );
}

/** Dispatch to the editor for this question's format. */
function QuestionEditor({ q, idx, onChange, onRemove }: {
  q: Question; idx: number; onChange: (q: Question) => void; onRemove: () => void;
}) {
  if (q.type === 'multiple_choice') {
    return <MCEditor q={q} idx={idx} onChange={onChange} onRemove={onRemove} />;
  }
  if (q.type === 'fill_blank') {
    return <FBEditor q={q} idx={idx} onChange={onChange} onRemove={onRemove} />;
  }
  if (q.type === 'word_match') {
    return <WMEditor q={q} idx={idx} onChange={onChange} onRemove={onRemove} />;
  }
  return <OREditor q={q} idx={idx} onChange={onChange} onRemove={onRemove} />;
}

/** Questions in part order, so the numbering the student sees is contiguous. */
function sortBySection(questions: Question[]): Question[] {
  return [...questions].sort((a, b) => (a.section ?? 1) - (b.section ?? 1));
}

/**
 * IELTS authoring: one block per exam part, laid out to match the real paper.
 *
 * The blocks are **not** something the author builds up — the module decides how
 * many there are (Listening 4 sections, Reading 3 passages, Writing 2 tasks,
 * Speaking 3 parts), so they are all on screen from the first click, empty and
 * waiting. That is the difference between "here is the exam, fill it in" and
 * "invent the structure yourself", which is what an add-a-part button asked for.
 *
 * Each block has its own "add question here". Picking a part number from a
 * dropdown on every question (the first attempt at this) meant the structure
 * existed only in the author's head, and one forgotten dropdown silently dumped
 * a question into Part 1.
 *
 * The array is kept sorted by part, because the student's question numbers are
 * positions in it — unsorted, Part 1 would read "Questions 1, 2 and 9".
 */
function SectionedEditor({ questionType, questions, onChange, parts, partLabel }: {
  questionType: QuestionType;
  questions: Question[];
  onChange: (questions: Question[]) => void;
  parts: number;
  partLabel: string;
}) {
  const ordered = sortBySection(questions);
  const blocks = Array.from({ length: parts }, (_, i) => i + 1);
  /** Questions parked beyond this module's structure (older content). */
  const strays = ordered.filter((q) => (q.section ?? 1) > parts).length;

  function update(q: Question, at: number) {
    onChange(ordered.map((x, i) => (i === at ? q : x)));
  }
  function remove(at: number) {
    onChange(ordered.filter((_, i) => i !== at));
  }
  /** Append a blank question to the end of `part`'s run. */
  function addTo(part: number) {
    const q = { ...blankQuestion(questionType), section: part };
    onChange(sortBySection([...ordered, q]));
  }
  function moveTo(at: number, part: number) {
    onChange(sortBySection(ordered.map((x, i) => (i === at ? { ...x, section: part } : x))));
  }
  /** Pull questions authored under a part this module does not have. */
  function rescueStrays() {
    onChange(
      sortBySection(
        ordered.map((q) => ((q.section ?? 1) > parts ? { ...q, section: parts } : q)),
      ),
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Жинхэнэ {partLabel === 'Task' ? 'Writing' : ''} бүтэц: <strong>{parts} {partLabel}</strong>.
        Асуултаа тохирох хэсэгт нь нэмнэ үү — сурагчид яг ийм хэсгүүдээр харагдана.
      </p>

      {strays > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span>{strays} асуулт энэ модульд байхгүй хэсэгт хамаарч байна.</span>
          <button onClick={rescueStrays} className="font-semibold underline">
            {partLabel} {parts} рүү зөөх
          </button>
        </div>
      )}

      {blocks.map((part) => {
        const rows = ordered
          .map((q, i) => ({ q, i }))
          .filter(({ q }) => (q.section ?? 1) === part);
        return (
          <div key={part} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-white">
                {partLabel} {part}
              </span>
              <span className="text-xs text-gray-500">
                {rows.length > 0
                  ? `${rows.length} асуулт · №${rows[0].i + 1}–${rows[rows.length - 1].i + 1}`
                  : 'Хоосон'}
              </span>
            </div>

            {rows.map(({ q, i }) => (
              <div key={i} className="space-y-1">
                <QuestionEditor
                  q={q}
                  idx={i}
                  onChange={(nq) => update(nq, i)}
                  onRemove={() => remove(i)}
                />
                <MoveToPart
                  value={part}
                  parts={parts}
                  partLabel={partLabel}
                  onChange={(next) => moveTo(i, next)}
                />
              </div>
            ))}

            <button
              onClick={() => addTo(part)}
              className="flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-200 py-2 text-xs font-medium text-gray-500 hover:border-primary hover:text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> {partLabel} {part}-т асуулт нэмэх
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Move one question to another part. */
function MoveToPart({ value, parts, partLabel, onChange }: {
  value: number; parts: number; partLabel: string; onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pr-1">
      <label className="text-[11px] text-gray-400">Өөр хэсэг рүү:</label>
      <select
        className="rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] focus:border-primary focus:outline-none"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {Array.from({ length: parts }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>{partLabel} {n}</option>
        ))}
      </select>
    </div>
  );
}

/** "Add question" button kept tiny + local so the editor file is self-contained. */
function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:border-primary hover:text-primary"
    >
      <Plus className="h-4 w-4" /> Асуулт нэмэх
    </button>
  );
}
