import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';

interface Lesson {
  id: string;
  title: string;
  type: string;
  level: string;
  isPublished: boolean;
  priceSparks: number;
}

const typeOptions = [
  { value: 'vocabulary', label: 'Үгийн сан' },
  { value: 'grammar', label: 'Дүрэм' },
  { value: 'listening', label: 'Сонсгол' },
  { value: 'reading', label: 'Унших' },
  { value: 'writing', label: 'Бичих' },
  { value: 'fill', label: 'Нөхөх' },
];
const levelOptions = [
  { value: 'a1', label: 'A1' }, { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' }, { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1' }, { value: 'c2', label: 'C2' },
];

interface LessonForm {
  title: string; type: string; level: string;
  priceSparks: number; content: string;
}
const emptyForm: LessonForm = { title: '', type: 'vocabulary', level: 'a1', priceSparks: 0, content: '{}' };

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<Lesson[]>('/lessons');
    setLessons(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setEditing(null); setError(''); setModal('create'); }
  function openEdit(l: Lesson) {
    setForm({ title: l.title, type: l.type, level: l.level, priceSparks: l.priceSparks, content: '{}' });
    setEditing(l); setError(''); setModal('edit');
  }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    setSaving(true); setError('');
    try {
      let content: unknown;
      try { content = JSON.parse(form.content); } catch { setError('Content буруу JSON байна'); setSaving(false); return; }
      const payload = { ...form, content };
      if (modal === 'create') await api.post('/lessons', payload);
      else if (editing) await api.patch(`/lessons/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function togglePublish(l: Lesson) {
    await api.patch(`/lessons/${l.id}`, { isPublished: !l.isPublished });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Хичээл устгах уу?')) return;
    await api.delete(`/lessons/${id}`);
    load();
  }

  const columns = [
    { key: 'title', header: 'Гарчиг', render: (l: Lesson) => <span className="font-medium">{l.title}</span> },
    { key: 'type', header: 'Төрөл', render: (l: Lesson) => <Badge color="blue">{l.type}</Badge> },
    { key: 'level', header: 'Түвшин', render: (l: Lesson) => <Badge color="gray">{l.level.toUpperCase()}</Badge> },
    {
      key: 'price', header: 'Үнэ', render: (l: Lesson) =>
        l.priceSparks > 0 ? <span className="text-amber font-medium">✨ {l.priceSparks}</span> : <span className="text-gray-400">Үнэгүй</span>,
    },
    {
      key: 'status', header: 'Статус', render: (l: Lesson) =>
        <Badge color={l.isPublished ? 'green' : 'gray'}>{l.isPublished ? 'Нийтлэгдсэн' : 'Ноорог'}</Badge>,
    },
    {
      key: 'actions', header: '', render: (l: Lesson) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => togglePublish(l)} title={l.isPublished ? 'Нуух' : 'Нийтлэх'}>
            {l.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(l)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ), className: 'text-right',
    },
  ];

  return (
    <>
      <PageHeader
        title="Хичээлүүд"
        description={`Нийт: ${lessons.length}`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Хичээл нэмэх</Button>}
      />
      <Table columns={columns} rows={lessons} keyFn={(l) => l.id} empty="Хичээл байхгүй" />

      {modal && (
        <Modal title={modal === 'create' ? 'Хичээл нэмэх' : 'Хичээл засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Төрөл" options={typeOptions} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              <Select label="Түвшин" options={levelOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </div>
            <Input label="Үнэ (Sparks, 0=үнэгүй)" type="number" min={0} value={form.priceSparks}
              onChange={(e) => setForm({ ...form, priceSparks: Number(e.target.value) })} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Content (JSON)</label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={5}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
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
