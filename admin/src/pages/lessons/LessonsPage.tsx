import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Image, Film } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { FileUpload } from '../../components/FileUpload';
import { ImageCropUpload } from '../../components/ImageCropUpload';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';
import { Pagination } from '../../components/Pagination';
import { levelFormOptions as levelOptions } from '../../lib/options';

const LIMIT = 20;

interface Lesson {
  id: string;
  title: string;
  type: string;
  level: string;
  isPublished: boolean;
  priceSparks: number;
  description?: string;
  content?: { imageUrl?: string; videoUrl?: string; topic?: string };
}

const typeOptions = [
  { value: 'vocabulary', label: 'Үгийн сан' },
  { value: 'grammar',    label: 'Дүрэм' },
  { value: 'listening',  label: 'Сонсгол' },
  { value: 'reading',    label: 'Унших' },
  { value: 'writing',    label: 'Бичих' },
  { value: 'fill',       label: 'Нөхөх' },
];

const topicOptions = [
  { value: '',               label: '— Select topic —' },
  // Conversation
  { value: 'greetings',     label: '👋 Greetings & Farewells' },
  { value: 'introductions', label: '🙋 Introductions' },
  { value: 'dialogue',      label: '💬 Conversations & Dialogues' },
  { value: 'phone',         label: '📞 Phone Calls' },
  { value: 'requests',      label: '🙏 Requests & Offers' },
  // Grammar
  { value: 'articles',      label: '📌 Articles (a, an, the)' },
  { value: 'tenses',        label: '⏰ Tenses' },
  { value: 'questions',     label: '❓ Questions' },
  { value: 'negation',      label: '🚫 Negation' },
  { value: 'prepositions',  label: '📍 Prepositions' },
  { value: 'adjectives',    label: '🎨 Adjectives' },
  { value: 'comparatives',  label: '📊 Comparatives & Superlatives' },
  { value: 'modal_verbs',   label: '🔧 Modal Verbs (can, must, should)' },
  { value: 'conditionals',  label: '🔀 Conditionals (if / unless)' },
  // Vocabulary by topic
  { value: 'family',        label: '👨‍👩‍👧 Family' },
  { value: 'food',          label: '🍎 Food & Drinks' },
  { value: 'animals',       label: '🐶 Animals' },
  { value: 'weather',       label: '🌤 Weather' },
  { value: 'places',        label: '🗺 Places & Directions' },
  { value: 'jobs',          label: '💼 Jobs & Professions' },
  { value: 'sports',        label: '⚽ Sports & Hobbies' },
  { value: 'body',          label: '🫀 Body Parts & Health' },
  { value: 'time',          label: '📅 Time, Days & Dates' },
  { value: 'numbers',       label: '🔢 Numbers & Counting' },
  { value: 'colors',        label: '🌈 Colors & Shapes' },
  { value: 'clothing',      label: '👕 Clothing & Fashion' },
  { value: 'travel',        label: '✈️ Travel & Tourism' },
  { value: 'school',        label: '🏫 School & Education' },
  { value: 'technology',    label: '💻 Technology' },
  { value: 'business',      label: '📈 Business & Work' },
  { value: 'nature',        label: '🌿 Nature & Environment' },
  { value: 'emotions',      label: '😊 Emotions & Feelings' },
  { value: 'shopping',      label: '🛒 Shopping' },
  { value: 'home',          label: '🏠 Home & Furniture' },
];

interface LessonForm {
  title: string; type: string; level: string; priceSparks: number;
  description: string; imageUrl: string; videoUrl: string; topic: string;
}
const emptyForm: LessonForm = {
  title: '', type: 'vocabulary', level: 'a1', priceSparks: 0,
  description: '', imageUrl: '', videoUrl: '', topic: '',
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'preview'>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [preview, setPreview] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<{ items: Lesson[]; total: number }>(`/lessons?page=${page}&limit=${LIMIT}`);
    setLessons(data.items ?? []);
    setTotal(data.total ?? 0);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setEditing(null); setError(''); setModal('create'); }
  function openEdit(l: Lesson) {
    setForm({
      title: l.title, type: l.type, level: l.level, priceSparks: l.priceSparks,
      description: l.description ?? '',
      imageUrl: l.content?.imageUrl ?? '',
      videoUrl: l.content?.videoUrl ?? '',
      topic: l.content?.topic ?? '',
    });
    setEditing(l); setError(''); setModal('edit');
  }
  function openPreview(l: Lesson) { setPreview(l); setModal('preview'); }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    setSaving(true); setError('');
    try {
      const { description, imageUrl, videoUrl, topic, ...rest } = form;
      const content: Record<string, string> = {};
      if (imageUrl) content.imageUrl = imageUrl;
      if (videoUrl) content.videoUrl = videoUrl;
      if (topic) content.topic = topic;
      const payload = { ...rest, description: description || undefined, content, isPublished: true };
      if (modal === 'create') await api.post('/lessons', payload);
      else if (editing) await api.patch(`/lessons/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Хичээл устгах уу?')) return;
    await api.delete(`/lessons/${id}`);
    load();
  }

  const columns = [
    {
      key: 'media', header: '',
      render: (l: Lesson) => {
        const img = l.content?.imageUrl;
        const vid = l.content?.videoUrl;
        if (img) return (
          <button onClick={() => openPreview(l)} title="Зураг харах">
            <img src={img} alt="" className="h-10 w-14 rounded object-cover border border-gray-200 hover:opacity-80 transition-opacity" />
          </button>
        );
        if (vid) return (
          <button onClick={() => openPreview(l)} title="Видео харах"
            className="flex h-10 w-14 items-center justify-center rounded border border-gray-200 bg-gray-100 hover:bg-gray-200 transition-colors">
            <Film className="h-4 w-4 text-gray-500" />
          </button>
        );
        return <div className="h-10 w-14 rounded border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
          <Image className="h-4 w-4 text-gray-300" />
        </div>;
      },
      className: 'w-16',
    },
    { key: 'title', header: 'Гарчиг', render: (l: Lesson) => <span className="font-medium">{l.title}</span> },
    { key: 'type', header: 'Төрөл', render: (l: Lesson) => <Badge color="blue">{l.type}</Badge> },
    { key: 'level', header: 'Түвшин', render: (l: Lesson) => <Badge color="gray">{l.level.toUpperCase()}</Badge> },
    {
      key: 'price', header: 'Үнэ', render: (l: Lesson) =>
        l.priceSparks > 0 ? <span className="text-amber font-medium">✨ {l.priceSparks}</span> : <span className="text-gray-400">Үнэгүй</span>,
    },
    {
      key: 'actions', header: '', render: (l: Lesson) => (
        <div className="flex gap-1 justify-end">
          <RowActions onEdit={() => openEdit(l)} onDelete={() => remove(l.id)} />
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
      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Хичээл нэмэх' : 'Хичээл засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Төрөл" options={typeOptions} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              <Select label="Түвшин" options={levelOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </div>
            <Select
              label="Хичээлийн агуулга"
              options={topicOptions}
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Тайлбар / Контент</label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={4}
                placeholder="Хичээлийн тайлбар, дүрэм, тэмдэглэл..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ImageCropUpload
                label="Зураг (заавал биш)"
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
              />
              <FileUpload
                accept="video"
                label="Видео (заавал биш)"
                value={form.videoUrl}
                onChange={(url) => setForm({ ...form, videoUrl: url })}
              />
            </div>
            <Input label="Үнэ (Sparks, 0=үнэгүй)" type="number" min={0} value={form.priceSparks}
              onChange={(e) => setForm({ ...form, priceSparks: Number(e.target.value) })} />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving} />
          </div>
        </Modal>
      )}

      {/* Media preview modal */}
      {modal === 'preview' && preview && (
        <Modal title={preview.title} onClose={() => { setModal(null); setPreview(null); }}>
          <div className="space-y-4">
            {preview.content?.imageUrl && (
              <div>
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Image className="h-3 w-3" /> Зураг</p>
                <img
                  src={preview.content.imageUrl}
                  alt={preview.title}
                  className="w-full rounded-xl border border-gray-200 object-contain max-h-80"
                />
              </div>
            )}
            {preview.content?.videoUrl && (
              <div>
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Film className="h-3 w-3" /> Видео</p>
                <video
                  src={preview.content.videoUrl}
                  controls
                  className="w-full rounded-xl border border-gray-200 max-h-80"
                />
              </div>
            )}
            {!preview.content?.imageUrl && !preview.content?.videoUrl && (
              <p className="text-sm text-gray-400 text-center py-6">Медиа файл байхгүй байна</p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button onClick={() => { setModal(null); openEdit(preview); }}>
                <Pencil className="h-4 w-4" /> Засах
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
