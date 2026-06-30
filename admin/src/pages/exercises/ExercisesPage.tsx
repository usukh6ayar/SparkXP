import { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, EyeOff, Upload, Trash2 } from 'lucide-react';
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
import { levelFormOptions as LEVEL_OPTIONS } from '../../lib/options';
import {
  QuizQuestionsEditor,
  type Question,
  type QuestionType,
} from '../../components/QuizQuestionsEditor';
import ReadingPage from '../reading/ReadingPage';

/** The 4 exercise (Дасгал) categories. Speaking = coming soon for now. */
const CATS = [
  { key: 'listening', label: 'Сонсгол' },
  { key: 'reading', label: 'Унших' },
  { key: 'writing', label: 'Бичих' },
  { key: 'speaking', label: 'Ярих' },
] as const;

const QTYPE_OPTIONS = [
  { value: 'multiple_choice', label: 'Олон сонголт' },
  { value: 'fill_blank', label: 'Нөхөх' },
  { value: 'word_match', label: 'Үг буудах' },
];

interface Exercise {
  id: string;
  title: string;
  level: string;
  category: string | null;
  quizType: string | null;
  xpReward: number;
  isPublished: boolean;
  questions: Question[];
}

interface Form {
  title: string;
  level: string;
  questionType: QuestionType;
  questions: Question[];
  xpReward: number;
  isPublished: boolean;
}
const emptyForm: Form = {
  title: '', level: 'a1', questionType: 'multiple_choice', questions: [], xpReward: 50, isPublished: false,
};

export default function ExercisesPage() {
  const [cat, setCat] = useState<string>('listening');
  const [items, setItems] = useState<Exercise[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selection (bulk publish/delete)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // CSV/JSON import
  const [importOpen, setImportOpen] = useState(false);
  const [impTitle, setImpTitle] = useState('');
  const [impLevel, setImpLevel] = useState('a1');
  const [impType, setImpType] = useState<QuestionType>('multiple_choice');
  const [impText, setImpText] = useState('');
  const [importing, setImporting] = useState(false);
  const [impError, setImpError] = useState('');

  const load = useCallback(async () => {
    if (cat === 'speaking' || cat === 'reading') { setItems([]); return; }
    const data = await api.get<{ items: Exercise[] }>(
      `/quizzes?standalone=true&category=${cat}&limit=200`,
    );
    setItems(data.items ?? []);
    setSelected(new Set());
  }, [cat]);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(emptyForm); setEditing(null); setError(''); setModal('create');
  }
  function openEdit(ex: Exercise) {
    const qt = (ex.quizType as QuestionType) || (ex.questions[0]?.type ?? 'multiple_choice');
    setForm({
      title: ex.title, level: ex.level, questionType: qt,
      questions: ex.questions ?? [], xpReward: ex.xpReward, isPublished: ex.isPublished,
    });
    setEditing(ex); setError(''); setModal('edit');
  }

  function changeType(qt: QuestionType) {
    // Switching format resets questions (different shape).
    setForm((f) => ({ ...f, questionType: qt, questions: f.questions.filter((q) => q.type === qt) }));
  }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    if (form.questions.length === 0) { setError('Дор хаяж нэг асуулт нэмнэ үү'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(),
        level: form.level,
        category: cat, // standalone exercise → category = skill, no lessonId
        quizType: form.questionType,
        questions: form.questions,
        xpReward: form.xpReward,
        isPublished: form.isPublished,
      };
      if (modal === 'create') await api.post('/quizzes', payload);
      else if (editing) await api.patch(`/quizzes/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function togglePublish(ex: Exercise) {
    await api.patch(`/quizzes/${ex.id}`, { isPublished: !ex.isPublished });
    load();
  }
  async function remove(id: string) {
    if (!confirm('Дасгал устгах уу?')) return;
    await api.delete(`/quizzes/${id}`);
    load();
  }

  // ── Selection + bulk actions ──
  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
  }
  async function bulkPublish(isPublished: boolean) {
    await Promise.all([...selected].map((id) => api.patch(`/quizzes/${id}`, { isPublished })));
    load();
  }
  async function bulkDelete() {
    if (!confirm(`${selected.size} дасгал устгах уу?`)) return;
    await Promise.all([...selected].map((id) => api.delete(`/quizzes/${id}`)));
    load();
  }

  // ── CSV / JSON import (rows = questions) ──
  /** Parse pasted CSV (pipe-delimited) or a JSON array into a questions[]. */
  function parseQuestions(text: string, type: QuestionType): Question[] {
    const trimmed = text.trim();
    if (trimmed.startsWith('[')) {
      const arr = JSON.parse(trimmed) as Question[];
      if (!Array.isArray(arr)) throw new Error('JSON массив байх ёстой');
      return arr;
    }
    // Pipe-delimited lines, one question per line.
    return trimmed
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const p = line.split('|').map((s) => s.trim());
        if (type === 'fill_blank') {
          return { type: 'fill_blank', question: p[0], answer: p[1] ?? '', points: Number(p[2] || 10) };
        }
        // multiple_choice: question | opt1 | opt2 | ... | correctNo | points
        const points = Number(p[p.length - 1] || 10);
        const correctNo = Number(p[p.length - 2] || 1);
        const options = p.slice(1, p.length - 2);
        return { type: 'multiple_choice', question: p[0], options, correct: Math.max(0, correctNo - 1), points };
      });
  }

  async function runImport() {
    if (!impTitle.trim()) { setImpError('Гарчиг оруулна уу'); return; }
    let questions: Question[];
    try {
      questions = parseQuestions(impText, impType);
    } catch (e) {
      setImpError(e instanceof Error ? e.message : 'Задлахад алдаа гарлаа');
      return;
    }
    if (questions.length === 0) { setImpError('Асуулт олдсонгүй'); return; }
    setImporting(true); setImpError('');
    try {
      await api.post('/quizzes', {
        title: impTitle.trim(), level: impLevel, category: cat,
        quizType: impType, questions, xpReward: 50, isPublished: false,
      });
      setImportOpen(false); setImpTitle(''); setImpText('');
      load();
    } catch (e: unknown) {
      setImpError(e instanceof Error ? e.message : 'Импорт амжилтгүй');
    } finally { setImporting(false); }
  }

  const allChecked = items.length > 0 && selected.size === items.length;
  const columns = [
    {
      key: 'sel',
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} />,
      render: (e: Exercise) => <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleRow(e.id)} />,
      className: 'w-8',
    },
    { key: 'title', header: 'Гарчиг', render: (e: Exercise) => <span className="font-medium">{e.title}</span> },
    { key: 'level', header: 'Түвшин', render: (e: Exercise) => <Badge color="gray">{e.level.toUpperCase()}</Badge> },
    { key: 'qs', header: 'Асуулт', render: (e: Exercise) => <span className="text-gray-600">{e.questions?.length ?? 0}</span> },
    { key: 'xp', header: 'XP', render: (e: Exercise) => <span className="text-primary font-medium">⚡ {e.xpReward}</span> },
    {
      key: 'status', header: 'Төлөв',
      render: (e: Exercise) => (
        <button onClick={() => togglePublish(e)} title="Дарж нийтлэх төлөв солих">
          {e.isPublished ? <Badge color="green">Нийтэлсэн</Badge> : <Badge color="gray">Ноорог</Badge>}
        </button>
      ),
    },
    {
      key: 'actions', header: '',
      render: (e: Exercise) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => togglePublish(e)} title={e.isPublished ? 'Нийтлэхээ болих' : 'Нийтлэх'}>
            {e.isPublished ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-green-600" />}
          </Button>
          <RowActions onEdit={() => openEdit(e)} onDelete={() => remove(e.id)} />
        </div>
      ),
      className: 'text-right',
    },
  ];

  const speaking = cat === 'speaking';
  const reading = cat === 'reading';

  return (
    <>
      <PageHeader
        title="Дасгал"
        description="Хичээлээс тусдаа, бие даасан дасгалууд (4 төрөл)"
        action={!speaking && !reading && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setImpError(''); setImportOpen(true); }}><Upload className="h-4 w-4" /> Импорт</Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Дасгал нэмэх</Button>
          </div>
        )}
      />

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => setCat(c.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${cat === c.key ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Bulk action bar */}
      {!speaking && !reading && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">{selected.size} сонгосон:</span>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(true)}>Нийтлэх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(false)}>Ноорог болгох</Button>
          <Button variant="danger" size="sm" onClick={bulkDelete}><Trash2 className="h-4 w-4" /> Устгах</Button>
        </div>
      )}

      {speaking ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          🎤 Ярих дасгал — тун удахгүй (яриа таних дэд бүтэц бэлэн болоход)
        </div>
      ) : reading ? (
        <ReadingPage embedded />
      ) : (
        <Table columns={columns} rows={items} keyFn={(e) => e.id} empty="Дасгал байхгүй" />
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Дасгал нэмэх' : 'Дасгал засах'} onClose={() => setModal(null)} size="2xl">
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select label="Түвшин" options={LEVEL_OPTIONS} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Select label="Асуултын төрөл" options={QTYPE_OPTIONS} value={form.questionType} onChange={(e) => changeType(e.target.value as QuestionType)} />
              <Input label="XP шагнал" type="number" min={0} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })} />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Асуултууд ({form.questions.length})</label>
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
        </Modal>
      )}

      {/* CSV / JSON import — rows = questions → one new exercise */}
      {importOpen && (
        <Modal title={`Дасгал импорт (${CATS.find((c) => c.key === cat)?.label})`} onClose={() => setImportOpen(false)} size="2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Input label="Гарчиг" value={impTitle} onChange={(e) => setImpTitle(e.target.value)} />
              <Select label="Түвшин" options={LEVEL_OPTIONS} value={impLevel} onChange={(e) => setImpLevel(e.target.value)} />
              <Select
                label="Асуултын төрөл"
                options={[{ value: 'multiple_choice', label: 'Олон сонголт' }, { value: 'fill_blank', label: 'Нөхөх' }]}
                value={impType}
                onChange={(e) => setImpType(e.target.value as QuestionType)}
              />
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
              <p className="font-medium text-gray-700">Формат (мөр бүр = 1 асуулт, `|`-аар тусгаарла):</p>
              {impType === 'fill_blank' ? (
                <p className="mt-1 font-mono">She ___ to school. | goes | 10</p>
              ) : (
                <p className="mt-1 font-mono">Нийслэл? | Улаанбаатар | Дархан | Эрдэнэт | 1 | 10</p>
              )}
              <p className="mt-1">
                {impType === 'fill_blank'
                  ? 'асуулт | зөв хариулт | оноо'
                  : 'асуулт | сонголт1 | сонголт2 | … | зөв№(1-ээс) | оноо'}
                . Эсвэл JSON массив ([{'{'}…{'}'}) буулгаж болно.
              </p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Өгөгдөл</label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={8}
                value={impText}
                onChange={(e) => setImpText(e.target.value)}
                placeholder="Энд CSV (|-аар) эсвэл JSON буулгана..."
              />
            </div>
            {impError && <p className="text-sm text-red-500">{impError}</p>}
            <FormActions onCancel={() => setImportOpen(false)} onSave={runImport} saving={importing} saveLabel="Импортлох" />
          </div>
        </Modal>
      )}
    </>
  );
}
