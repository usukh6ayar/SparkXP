import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';
import {
  QuizQuestionsEditor,
  type Question,
  type QuestionType,
} from '../../components/QuizQuestionsEditor';

/** The 4 lesson-test categories. Speaking = coming soon. */
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

interface Test {
  id: string;
  title: string;
  category: string | null;
  quizType: string | null;
  xpReward: number;
  isPublished: boolean;
  questions: Question[];
}

interface TestForm {
  title: string;
  questionType: QuestionType;
  questions: Question[];
  xpReward: number;
  isPublished: boolean;
}
const emptyForm: TestForm = {
  title: '', questionType: 'multiple_choice', questions: [], xpReward: 20, isPublished: true,
};

/**
 * Per-lesson tests, grouped into the 4 categories. Tests are quizzes linked to
 * the lesson (lessonId set) — content specific to this lesson. Rendered inside
 * the lesson edit modal (needs a saved lessonId).
 */
export function LessonTests({ lessonId, level }: { lessonId: string; level: string }) {
  const [cat, setCat] = useState<string>('listening');
  const [tests, setTests] = useState<Test[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Test | null>(null);
  const [form, setForm] = useState<TestForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (cat === 'speaking') { setTests([]); return; }
    const data = await api.get<{ items: Test[] }>(`/quizzes?lessonId=${lessonId}&category=${cat}&limit=100`);
    setTests(data.items ?? []);
  }, [lessonId, cat]);
  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setEditing(null); setError(''); setModal('create'); }
  function openEdit(t: Test) {
    const qt = (t.quizType as QuestionType) || (t.questions[0]?.type ?? 'multiple_choice');
    setForm({ title: t.title, questionType: qt, questions: t.questions ?? [], xpReward: t.xpReward, isPublished: t.isPublished });
    setEditing(t); setError(''); setModal('edit');
  }
  function changeType(qt: QuestionType) {
    setForm((f) => ({ ...f, questionType: qt, questions: f.questions.filter((q) => q.type === qt) }));
  }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    if (form.questions.length === 0) { setError('Дор хаяж нэг асуулт нэмнэ үү'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(), level, lessonId, category: cat,
        quizType: form.questionType, questions: form.questions,
        xpReward: form.xpReward, isPublished: form.isPublished,
      };
      if (modal === 'create') await api.post('/quizzes', payload);
      else if (editing) await api.patch(`/quizzes/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Тест устгах уу?')) return;
    await api.delete(`/quizzes/${id}`);
    load();
  }

  const speaking = cat === 'speaking';

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-800">Тестүүд (энэ хичээлийн агуулгаар)</h3>

      <div className="mb-3 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${cat === c.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {speaking ? (
        <p className="py-4 text-center text-xs text-gray-400">🎤 Ярих тест — тун удахгүй</p>
      ) : (
        <>
          <div className="space-y-2">
            {tests.length === 0 && <p className="text-xs text-gray-400">Энэ ангилалд тест алга.</p>}
            {tests.map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                <span className="flex-1 text-sm font-medium">{t.title}</span>
                <span className="text-xs text-gray-400">{t.questions?.length ?? 0} асуулт</span>
                {t.isPublished ? <Badge color="green">Нийтэлсэн</Badge> : <Badge color="gray">Ноорог</Badge>}
                <RowActions onEdit={() => openEdit(t)} onDelete={() => remove(t.id)} />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={openCreate}><Plus className="h-4 w-4" /> Тест нэмэх</Button>
          </div>
        </>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Тест нэмэх' : 'Тест засах'} onClose={() => setModal(null)} size="2xl">
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Асуултын төрөл" options={QTYPE_OPTIONS} value={form.questionType} onChange={(e) => changeType(e.target.value as QuestionType)} />
              <Input label="XP шагнал" type="number" min={0} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Асуултууд ({form.questions.length})</label>
              <QuizQuestionsEditor questionType={form.questionType} questions={form.questions} onChange={(questions) => setForm({ ...form, questions })} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Нийтлэх
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving} />
          </div>
        </Modal>
      )}
    </div>
  );
}
