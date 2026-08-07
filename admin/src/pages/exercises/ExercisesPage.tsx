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
import { Pagination } from '../../components/Pagination';
import { QuizImportModal } from '../../components/QuizImportModal';
import { levelFormOptions as LEVEL_OPTIONS, exerciseCategoryOptions } from '../../lib/options';
import {
  QuizQuestionsEditor,
  type Question,
  type QuestionType,
} from '../../components/QuizQuestionsEditor';
import ReadingPage from '../reading/ReadingPage';
import { toggleInSet } from '../../lib/utils';

const LIMIT = 20;

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
  topic: string | null;
  quizType: string | null;
  xpReward: number;
  isPublished: boolean;
  questions: Question[];
}

interface Form {
  title: string;
  level: string;
  topic: string;
  questionType: QuestionType;
  questions: Question[];
  xpReward: number;
  isPublished: boolean;
}
// Published by default: the app only lists `isPublished=true` exercises, and a
// draft-by-default form is why newly authored дасгал never showed up on mobile.
const emptyForm: Form = {
  title: '', level: 'a1', topic: '', questionType: 'multiple_choice', questions: [], xpReward: 50, isPublished: true,
};

export default function ExercisesPage() {
  const [cat, setCat] = useState<string>('listening');
  const [items, setItems] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selection (bulk publish/delete)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // CSV/JSON bulk import (shared modal)
  const [importOpen, setImportOpen] = useState(false);

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
      title: ex.title, level: ex.level, topic: ex.topic ?? '', questionType: qt,
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
        topic: form.topic, // сэдэв within the skill ('' = no topic)
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
      toggleInSet(n, id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => (paged.every((i) => s.has(i.id)) ? new Set() : new Set(paged.map((i) => i.id))));
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

  const total = items.length;
  const paged = items.slice((page - 1) * LIMIT, page * LIMIT);
  const allChecked = paged.length > 0 && paged.every((e) => selected.has(e.id));
  const columns = [
    {
      key: 'sel',
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} />,
      render: (e: Exercise) => <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleRow(e.id)} />,
      className: 'w-8',
    },
    { key: 'title', header: 'Гарчиг', render: (e: Exercise) => <span className="font-medium">{e.title}</span> },
    {
      key: 'topic', header: 'Сэдэв',
      render: (e: Exercise) =>
        e.topic ? <Badge color="yellow">{e.topic}</Badge> : <span className="text-gray-300">—</span>,
    },
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
            <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Оруулах</Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Дасгал нэмэх</Button>
          </div>
        )}
      />

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCat(c.key); setPage(1); }}
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
        <>
          <Table columns={columns} rows={paged} keyFn={(e) => e.id} empty="Дасгал байхгүй" />
          <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
        </>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Дасгал нэмэх' : 'Дасгал засах'} onClose={() => setModal(null)} size="2xl">
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select label="Сэдэв (category)" options={exerciseCategoryOptions(cat)} value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
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

      {/* Bulk import — нэг CSV/JSON-оос олон дасгал */}
      {importOpen && (
        <QuizImportModal
          title={`Дасгал оруулах (${CATS.find((c) => c.key === cat)?.label})`}
          defaults={{ category: cat }}
          topicOptions={exerciseCategoryOptions(cat)}
          typeOptions={QTYPE_OPTIONS}
          onClose={() => setImportOpen(false)}
          onDone={load}
        />
      )}
    </>
  );
}
