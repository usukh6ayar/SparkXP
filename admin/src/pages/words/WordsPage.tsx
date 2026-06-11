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

interface Word {
  id: string;
  english: string;
  mongolian: string;
  level: string;
  lessonId: string | null;
}

const levelOptions = [
  { value: '', label: 'Бүх түвшин' },
  { value: 'a1', label: 'A1' }, { value: 'a2', label: 'A2' },
  { value: 'b1', label: 'B1' }, { value: 'b2', label: 'B2' },
  { value: 'c1', label: 'C1' }, { value: 'c2', label: 'C2' },
];
const levelFormOptions = levelOptions.slice(1);

const levelColors: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  a1: 'green', a2: 'green', b1: 'blue', b2: 'blue', c1: 'yellow', c2: 'red',
};

interface WordForm { english: string; mongolian: string; level: string; }
const empty: WordForm = { english: '', mongolian: '', level: 'a1' };

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState<WordForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const qs = levelFilter ? `?level=${levelFilter}` : '';
    const data = await api.get<{ items: Word[] }>(`/words${qs}`);
    setWords(data.items ?? []);
  }, [levelFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm(empty); setEditing(null); setError(''); setModal('create');
  }
  function openEdit(w: Word) {
    setForm({ english: w.english, mongolian: w.mongolian, level: w.level });
    setEditing(w); setError(''); setModal('edit');
  }

  async function save() {
    if (!form.english.trim() || !form.mongolian.trim()) {
      setError('Англи болон Монгол үгийг оруулна уу'); return;
    }
    setSaving(true); setError('');
    try {
      if (modal === 'create') {
        await api.post('/words', form);
      } else if (editing) {
        await api.patch(`/words/${editing.id}`, form);
      }
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Энэ үгийг устгах уу?')) return;
    await api.delete(`/words/${id}`);
    load();
  }

  const columns = [
    { key: 'english', header: 'Англи', render: (w: Word) => <span className="font-medium">{w.english}</span> },
    { key: 'mongolian', header: 'Монгол', render: (w: Word) => w.mongolian },
    {
      key: 'level', header: 'Түвшин', render: (w: Word) => (
        <Badge color={levelColors[w.level] ?? 'gray'}>{w.level.toUpperCase()}</Badge>
      ),
    },
    {
      key: 'actions', header: '', render: (w: Word) => (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <>
      <PageHeader
        title="Үгс"
        description={`Нийт: ${words.length} үг`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Үг нэмэх</Button>}
      />

      <div className="mb-4">
        <Select
          options={levelOptions}
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="w-40"
        />
      </div>

      <Table columns={columns} rows={words} keyFn={(w) => w.id} empty="Үг байхгүй байна" />

      {modal && (
        <Modal title={modal === 'create' ? 'Үг нэмэх' : 'Үг засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Input label="Англи үг" value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} placeholder="word" />
            <Input label="Монгол утга" value={form.mongolian} onChange={(e) => setForm({ ...form, mongolian: e.target.value })} placeholder="үг" />
            <Select label="Түвшин" options={levelFormOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
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
