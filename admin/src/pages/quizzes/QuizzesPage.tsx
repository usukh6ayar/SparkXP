import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';

interface Quiz { id: string; title: string; level: string; xpReward: number; questions: unknown[]; }

const levelOptions = [
  { value: 'a1', label: 'A1' }, { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' }, { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1' }, { value: 'c2', label: 'C2' },
];

const defaultQuestions = JSON.stringify([
  {
    type: 'multiple_choice',
    question: 'Жишээ асуулт?',
    options: ['А', 'Б', 'В', 'Г'],
    answer: 0,
  },
], null, 2);

interface QuizForm { title: string; level: string; xpReward: number; questions: string; }
const emptyForm: QuizForm = { title: '', level: 'a1', xpReward: 10, questions: defaultQuestions };

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Quiz | null>(null);
  const [form, setForm] = useState<QuizForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<{ items: Quiz[] }>('/quizzes');
    setQuizzes(data.items ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setEditing(null); setError(''); setModal('create'); }
  function openEdit(q: Quiz) {
    setForm({ title: q.title, level: q.level, xpReward: q.xpReward, questions: JSON.stringify(q.questions, null, 2) });
    setEditing(q); setError(''); setModal('edit');
  }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    setSaving(true); setError('');
    try {
      let questions: unknown;
      try { questions = JSON.parse(form.questions); } catch { setError('Questions буруу JSON байна'); setSaving(false); return; }
      const payload = { title: form.title, level: form.level, xpReward: form.xpReward, questions };
      if (modal === 'create') await api.post('/quizzes', payload);
      else if (editing) await api.patch(`/quizzes/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Сорил устгах уу?')) return;
    await api.delete(`/quizzes/${id}`);
    load();
  }

  const columns = [
    { key: 'title', header: 'Гарчиг', render: (q: Quiz) => <span className="font-medium">{q.title}</span> },
    { key: 'level', header: 'Түвшин', render: (q: Quiz) => <Badge color="gray">{q.level.toUpperCase()}</Badge> },
    { key: 'questions', header: 'Асуулт', render: (q: Quiz) => <span>{q.questions?.length ?? 0}</span> },
    {
      key: 'xp', header: 'XP шагнал', render: (q: Quiz) =>
        <span className="font-medium text-primary">⚡ {q.xpReward}</span>,
    },
    {
      key: 'actions', header: '', render: (q: Quiz) => (
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
        title="Сорилууд"
        description={`Нийт: ${quizzes.length}`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Сорил нэмэх</Button>}
      />
      <Table columns={columns} rows={quizzes} keyFn={(q) => q.id} empty="Сорил байхгүй" />

      {modal && (
        <Modal title={modal === 'create' ? 'Сорил нэмэх' : 'Сорил засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Түвшин" options={levelOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Input label="XP шагнал" type="number" min={0} value={form.xpReward}
                onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Асуултууд (JSON array)</label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={10}
                value={form.questions}
                onChange={(e) => setForm({ ...form, questions: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Болих</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Хадгалж байна...' : 'Хадгалах'}</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
