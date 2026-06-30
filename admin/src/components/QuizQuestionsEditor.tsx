import { Plus, GripVertical, X } from 'lucide-react';

// ── Question types (shared by Quiz builder, lesson tests, Дасгал) ────────────

export interface MCQuestion {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correct: number;
  points: number;
}
export interface FBQuestion {
  type: 'fill_blank';
  question: string;
  answer: string;
  points: number;
}
export interface WMQuestion {
  type: 'word_match';
  pairs: { left: string; right: string }[];
  points: number;
}
export type Question = MCQuestion | FBQuestion | WMQuestion;

/** The underlying graded question format. */
export type QuestionType = 'multiple_choice' | 'fill_blank' | 'word_match';

export function blankMC(): MCQuestion {
  return { type: 'multiple_choice', question: '', options: ['', '', '', ''], correct: 0, points: 10 };
}
export function blankFB(): FBQuestion {
  return { type: 'fill_blank', question: '', answer: '', points: 10 };
}
export function blankWM(): WMQuestion {
  return { type: 'word_match', pairs: [{ left: '', right: '' }, { left: '', right: '' }], points: 10 };
}
export function blankQuestion(t: QuestionType): Question {
  if (t === 'fill_blank') return blankFB();
  if (t === 'word_match') return blankWM();
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
}

/**
 * Reusable quiz/test question builder: renders each question in its type editor
 * and an "add question" button. Used by the Quiz page, lesson tests, and Дасгал.
 */
export function QuizQuestionsEditor({ questionType, questions, onChange }: Props) {
  function update(i: number, q: Question) {
    onChange(questions.map((x, idx) => (idx === i ? q : x)));
  }
  function remove(i: number) {
    onChange(questions.filter((_, idx) => idx !== i));
  }
  return (
    <div className="space-y-3">
      {questions.map((q, i) =>
        q.type === 'multiple_choice' ? (
          <MCEditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ) : q.type === 'fill_blank' ? (
          <FBEditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ) : (
          <WMEditor key={i} q={q} idx={i} onChange={(nq) => update(i, nq)} onRemove={() => remove(i)} />
        ),
      )}
      <Button onClick={() => onChange([...questions, blankQuestion(questionType)])} />
    </div>
  );
}

/** "Add question" button kept tiny + local so the editor file is self-contained. */
function Button({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-2.5 text-sm font-medium text-gray-500 hover:border-primary hover:text-primary"
    >
      <Plus className="h-4 w-4" /> Асуулт нэмэх
    </button>
  );
}
