import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, GripVertical, X } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';

// ── Types ──────────────────────────────────────────────────────────────────

interface MCQuestion {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correct: number;
  points: number;
}

interface FBQuestion {
  type: 'fill_blank';
  question: string;
  answer: string;
  points: number;
}

interface WMQuestion {
  type: 'word_match';
  pairs: { left: string; right: string }[];
  points: number;
}

type Question = MCQuestion | FBQuestion | WMQuestion;

interface Quiz {
  id: string;
  title: string;
  level: string;
  quizType: string | null;
  xpReward: number;
  isPublished: boolean;
  questions: Question[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const QUIZ_TYPES = [
  { value: 'multiple_choice', label: '🔵 Олон сонголт', desc: 'А, Б, В, Г сонголтоос нэгийг сонгоно' },
  { value: 'fill_blank',      label: '✏️ Нөхөх',         desc: 'Хоосон зайг нөхөж бичнэ' },
  { value: 'word_match',      label: '🎯 Үг буудах',      desc: 'Үгийг тохирох орчуулгатай нь холбоно' },
];

const LEVEL_OPTIONS = [
  { value: 'a1', label: 'A1' }, { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' }, { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1' }, { value: 'c2', label: 'C2' },
];

const TYPE_COLORS: Record<string, 'blue' | 'green' | 'yellow'> = {
  multiple_choice: 'blue',
  fill_blank: 'green',
  word_match: 'yellow',
};

const TYPE_LABELS: Record<string, string> = {
  multiple_choice: 'Олон сонголт',
  fill_blank: 'Нөхөх',
  word_match: 'Үг буудах',
};

// ── Helpers to create blank questions ─────────────────────────────────────

function blankMC(): MCQuestion {
  return { type: 'multiple_choice', question: '', options: ['', '', '', ''], correct: 0, points: 10 };
}
function blankFB(): FBQuestion {
  return { type: 'fill_blank', question: '', answer: '', points: 10 };
}
function blankWM(): WMQuestion {
  return { type: 'word_match', pairs: [{ left: '', right: '' }, { left: '', right: '' }], points: 10 };
}

function blankFor(qt: string): Question {
  if (qt === 'fill_blank') return blankFB();
  if (qt === 'word_match') return blankWM();
  return blankMC();
}

// ── Quiz question editor components ───────────────────────────────────────

function MCEditor({ q, idx, onChange, onRemove }: {
  q: MCQuestion; idx: number;
  onChange: (q: MCQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">#{idx + 1} · Олон сонголт</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400">
          <X className="h-4 w-4" />
        </button>
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
              type="radio"
              name={`correct-${idx}`}
              checked={q.correct === oi}
              onChange={() => onChange({ ...q, correct: oi })}
              className="accent-primary shrink-0"
              title="Зөв хариулт"
            />
            <input
              className={`flex-1 rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
                q.correct === oi ? 'border-green-400 bg-green-50' : 'border-gray-200'
              }`}
              placeholder={`${oi + 1}-р сонголт`}
              value={opt}
              onChange={(e) => {
                const opts = [...q.options];
                opts[oi] = e.target.value;
                onChange({ ...q, options: opts });
              }}
            />
          </div>
        ))}
        <p className="text-xs text-gray-400">☝️ Радио товч дарж зөв хариултыг тэмдэглэнэ</p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 shrink-0">Оноо:</label>
        <input
          type="number" min={1}
          className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none"
          value={q.points}
          onChange={(e) => onChange({ ...q, points: Math.max(1, Number(e.target.value)) })}
        />
      </div>
    </div>
  );
}

function FBEditor({ q, idx, onChange, onRemove }: {
  q: FBQuestion; idx: number;
  onChange: (q: FBQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-green-100 bg-green-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">#{idx + 1} · Нөхөх</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400">
          <X className="h-4 w-4" />
        </button>
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

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 shrink-0">Оноо:</label>
        <input
          type="number" min={1}
          className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none"
          value={q.points}
          onChange={(e) => onChange({ ...q, points: Math.max(1, Number(e.target.value)) })}
        />
      </div>
    </div>
  );
}

function WMEditor({ q, idx, onChange, onRemove }: {
  q: WMQuestion; idx: number;
  onChange: (q: WMQuestion) => void;
  onRemove: () => void;
}) {
  function updatePair(pi: number, side: 'left' | 'right', val: string) {
    const pairs = q.pairs.map((p, i) => i === pi ? { ...p, [side]: val } : p);
    onChange({ ...q, pairs });
  }
  function addPair() { onChange({ ...q, pairs: [...q.pairs, { left: '', right: '' }] }); }
  function removePair(pi: number) {
    if (q.pairs.length <= 2) return;
    onChange({ ...q, pairs: q.pairs.filter((_, i) => i !== pi) });
  }

  return (
    <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
        <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">#{idx + 1} · Үг буудах</span>
        <button onClick={onRemove} className="ml-auto text-gray-300 hover:text-red-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-500 px-1">
          <span>Англи үг</span>
          <span>Монгол утга</span>
        </div>
        {q.pairs.map((pair, pi) => (
          <div key={pi} className="flex items-center gap-2">
            <div className="grid grid-cols-2 gap-2 flex-1">
              <input
                className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                placeholder="apple"
                value={pair.left}
                onChange={(e) => updatePair(pi, 'left', e.target.value)}
              />
              <input
                className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm focus:outline-none"
                placeholder="алим"
                value={pair.right}
                onChange={(e) => updatePair(pi, 'right', e.target.value)}
              />
            </div>
            <button
              onClick={() => removePair(pi)}
              disabled={q.pairs.length <= 2}
              className="text-gray-300 hover:text-red-400 disabled:opacity-20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          onClick={addPair}
          className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 font-medium"
        >
          <Plus className="h-3 w-3" /> Хос нэмэх
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-gray-500 shrink-0">Оноо:</label>
        <input
          type="number" min={1}
          className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:outline-none"
          value={q.points}
          onChange={(e) => onChange({ ...q, points: Math.max(1, Number(e.target.value)) })}
        />
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

interface QuizForm {
  title: string;
  level: string;
  xpReward: number;
  quizType: string;
  questions: Question[];
}

const emptyForm = (qt = 'multiple_choice'): QuizForm => ({
  title: '', level: 'a1', xpReward: 10, quizType: qt, questions: [blankFor(qt)],
});

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [form, setForm] = useState<QuizForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<{ items: Quiz[] }>('/quizzes');
    setQuizzes(data.items ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate(qt = 'multiple_choice') {
    setForm(emptyForm(qt));
    setEditing(null); setError(''); setModal('create');
  }

  function openEdit(q: Quiz) {
    setForm({
      title: q.title,
      level: q.level,
      xpReward: q.xpReward,
      quizType: q.quizType ?? 'multiple_choice',
      questions: (q.questions ?? []) as Question[],
    });
    setEditing(q); setError(''); setModal('edit');
  }

  function addQuestion() {
    setForm(f => ({ ...f, questions: [...f.questions, blankFor(f.quizType)] }));
  }

  function updateQuestion(idx: number, q: Question) {
    setForm(f => ({ ...f, questions: f.questions.map((old, i) => i === idx ? q : old) }));
  }

  function removeQuestion(idx: number) {
    setForm(f => ({ ...f, questions: f.questions.filter((_, i) => i !== idx) }));
  }

  function validate(): string | null {
    if (!form.title.trim()) return 'Гарчиг оруулна уу';
    if (form.questions.length === 0) return 'Хамгийн багадаа 1 асуулт нэмнэ үү';
    for (let i = 0; i < form.questions.length; i++) {
      const q = form.questions[i];
      if (q.type === 'multiple_choice') {
        if (!q.question.trim()) return `Асуулт #${i + 1}: текст оруулна уу`;
        if (q.options.some(o => !o.trim())) return `Асуулт #${i + 1}: бүх сонголтыг бөглөнө үү`;
      } else if (q.type === 'fill_blank') {
        if (!q.question.trim()) return `Асуулт #${i + 1}: өгүүлбэр оруулна уу`;
        if (!q.answer.trim()) return `Асуулт #${i + 1}: хариулт оруулна уу`;
      } else if (q.type === 'word_match') {
        if (q.pairs.some(p => !p.left.trim() || !p.right.trim()))
          return `Асуулт #${i + 1}: бүх үгийн хосыг бөглөнө үү`;
      }
    }
    return null;
  }

  async function save() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title,
        level: form.level,
        xpReward: form.xpReward,
        quizType: form.quizType,
        questions: form.questions,
      };
      if (modal === 'create') await api.post('/quizzes', payload);
      else if (editing) await api.patch(`/quizzes/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Quiz устгах уу?')) return;
    await api.delete(`/quizzes/${id}`);
    load();
  }

  const columns = [
    {
      key: 'title', header: 'Гарчиг',
      render: (q: Quiz) => <span className="font-medium">{q.title}</span>,
    },
    {
      key: 'quizType', header: 'Төрөл',
      render: (q: Quiz) => (
        <Badge color={TYPE_COLORS[q.quizType ?? 'multiple_choice'] ?? 'blue'}>
          {TYPE_LABELS[q.quizType ?? 'multiple_choice'] ?? q.quizType}
        </Badge>
      ),
    },
    { key: 'level', header: 'Түвшин', render: (q: Quiz) => <Badge color="gray">{q.level.toUpperCase()}</Badge> },
    { key: 'questions', header: 'Асуулт', render: (q: Quiz) => <span>{q.questions?.length ?? 0}</span> },
    {
      key: 'xp', header: 'XP', render: (q: Quiz) =>
        <span className="font-medium text-primary">⚡ {q.xpReward}</span>,
    },
    {
      key: 'status', header: 'Статус',
      render: (q: Quiz) => <Badge color={q.isPublished ? 'green' : 'gray'}>{q.isPublished ? 'Нийтлэгдсэн' : 'Ноорог'}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: (q: Quiz) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEdit(q)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => remove(q.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ), className: 'text-right',
    },
  ];

  return (
    <>
      <PageHeader
        title="Quizzes"
        description={`Нийт: ${quizzes.length}`}
        action={
          <div className="flex gap-2">
            {QUIZ_TYPES.map(qt => (
              <Button key={qt.value} onClick={() => openCreate(qt.value)} size="sm">
                <Plus className="h-4 w-4" /> {qt.label}
              </Button>
            ))}
          </div>
        }
      />

      <Table columns={columns} rows={quizzes} keyFn={(q) => q.id} empty="Quiz байхгүй" />

      {modal && (
        <Modal
          title={modal === 'create' ? 'Quiz нэмэх' : 'Quiz засах'}
          onClose={() => setModal(null)}
        >
          <div className="space-y-5">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input
                  label="Гарчиг"
                  value={form.title}
                  onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="жишээ: Амьтны нэрс — A1"
                />
              </div>
              <Select
                label="Түвшин"
                options={LEVEL_OPTIONS}
                value={form.level}
                onChange={(e) => setForm(f => ({ ...f, level: e.target.value }))}
              />
              <Input
                label="XP шагнал"
                type="number" min={0}
                value={form.xpReward}
                onChange={(e) => setForm(f => ({ ...f, xpReward: Number(e.target.value) }))}
              />
            </div>

            {/* Quiz type selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Quiz төрөл</p>
              <div className="grid grid-cols-3 gap-2">
                {QUIZ_TYPES.map(qt => (
                  <button
                    key={qt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, quizType: qt.value }))}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${
                      form.quizType === qt.value
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="text-sm font-semibold">{qt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{qt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700">
                  Асуултууд ({form.questions.length})
                </p>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Асуулт нэмэх
                </button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                {form.questions.map((q, i) => {
                  if (q.type === 'multiple_choice') return (
                    <MCEditor key={i} q={q} idx={i}
                      onChange={(upd) => updateQuestion(i, upd)}
                      onRemove={() => removeQuestion(i)}
                    />
                  );
                  if (q.type === 'fill_blank') return (
                    <FBEditor key={i} q={q} idx={i}
                      onChange={(upd) => updateQuestion(i, upd)}
                      onRemove={() => removeQuestion(i)}
                    />
                  );
                  if (q.type === 'word_match') return (
                    <WMEditor key={i} q={q} idx={i}
                      onChange={(upd) => updateQuestion(i, upd)}
                      onRemove={() => removeQuestion(i)}
                    />
                  );
                  return null;
                })}

                {form.questions.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                    "Асуулт нэмэх" товч дарж эхэлнэ
                  </div>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setModal(null)}>Болих</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
