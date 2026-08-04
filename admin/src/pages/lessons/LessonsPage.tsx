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
import { LessonTests } from './LessonTests';
import { LessonWords } from './LessonWords';
import { levelFormOptions as levelOptions } from '../../lib/options';

const LIMIT = 20;

interface Lesson {
  id: string;
  title: string;
  type: string;
  level: string;
  /** Order within the level — the app shows lessons (and numbers them) by this. */
  position: number;
  isPublished: boolean;
  priceSparks: number;
  description?: string;
  thumbnailUrl?: string | null;
  content?: Record<string, string | undefined>;
}

const typeOptions = [
  { value: 'vocabulary', label: 'Үгийн сан' },
  { value: 'grammar',    label: 'Дүрэм' },
  { value: 'listening',  label: 'Сонсгол' },
  { value: 'reading',    label: 'Унших' },
  { value: 'writing',    label: 'Бичих' },
  { value: 'fill',       label: 'Нөхөх' },
];

/** Хичээлийн тайлбарын хязгаар — backend DTO-той ижил (@MaxLength(1000)). */
const DESC_MAX = 1000;

interface LessonForm {
  title: string; type: string; level: string; priceSparks: number;
  /** Text, not number: empty = "auto" (backend appends to the end of the level). */
  position: string;
  description: string; imageUrl: string; videoUrl: string; isPublished: boolean;
}
const emptyForm: LessonForm = {
  title: '', type: 'vocabulary', level: 'a1', priceSparks: 0, position: '',
  description: '', imageUrl: '', videoUrl: '', isPublished: true,
};

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'preview'>(null);
  const [editing, setEditing] = useState<Lesson | null>(null);
  const [preview, setPreview] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: Lesson[]; total: number }>(`/lessons?page=${page}&limit=${LIMIT}`);
      setLessons(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(emptyForm); setEditing(null); setError(''); setModal('create'); }
  function openEdit(l: Lesson) {
    setForm({
      title: l.title, type: l.type, level: l.level, priceSparks: l.priceSparks,
      position: String(l.position ?? ''),
      description: l.description ?? '',
      // Older lessons kept the cover only in `content`; newer ones in the column.
      imageUrl: l.thumbnailUrl ?? l.content?.imageUrl ?? '',
      videoUrl: l.content?.videoUrl ?? '',
      isPublished: l.isPublished,
    });
    setEditing(l); setError(''); setModal('edit');
  }
  function openPreview(l: Lesson) { setPreview(l); setModal('preview'); }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    if (form.description.length > DESC_MAX) { setError(`Тайлбар ${DESC_MAX} тэмдэгтээс богино байх ёстой`); return; }
    setSaving(true); setError('');
    try {
      const { description, imageUrl, videoUrl, position, ...rest } = form;
      // Merge, don't replace: `content` may hold keys this form doesn't edit.
      const content: Record<string, string | undefined> = { ...(editing?.content ?? {}) };
      content.imageUrl = imageUrl || undefined;
      content.videoUrl = videoUrl || undefined;
      const payload = {
        ...rest,
        description: description.trim() || null,
        content,
        // The app reads the cover from this column (content.imageUrl is legacy).
        thumbnailUrl: imageUrl || null,
        // Empty = let the backend append it to the end of the level.
        position: position.trim() === '' ? undefined : Number(position),
      };
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
      key: 'position', header: '#',
      render: (l: Lesson) => <span className="text-xs text-gray-400">{l.position || '—'}</span>,
      className: 'w-10',
    },
    {
      key: 'media', header: '',
      render: (l: Lesson) => {
        const img = l.thumbnailUrl ?? l.content?.imageUrl;
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
      key: 'published', header: 'Төлөв', render: (l: Lesson) =>
        l.isPublished ? <Badge color="green">Нийтэлсэн</Badge> : <Badge color="gray">Ноорог</Badge>,
    },
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
        description={`Нийт: ${total}`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Хичээл нэмэх</Button>}
      />
      <Table columns={columns} rows={lessons} keyFn={(l) => l.id} empty="Хичээл байхгүй" loading={loading} />
      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Хичээл нэмэх' : 'Хичээл засах'} onClose={() => setModal(null)} size="2xl">
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Төрөл" options={typeOptions} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              <Select label="Түвшин" options={levelOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium text-gray-700">Тайлбар / Контент</label>
                <span className={`text-xs ${form.description.length > DESC_MAX ? 'text-red-500' : 'text-gray-400'}`}>
                  {form.description.length}/{DESC_MAX}
                </span>
              </div>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={4}
                maxLength={DESC_MAX}
                placeholder="Хичээлийн тайлбар, дүрэм, тэмдэглэл..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <p className="text-xs text-gray-400">Апп дээр гарчгийн доор товч тайлбар болж харагдана.</p>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Үнэ (Sparks, 0=үнэгүй)" type="number" min={0} value={form.priceSparks}
                onChange={(e) => setForm({ ...form, priceSparks: Number(e.target.value) })} />
              <div>
                <Input label="Дараалал (хоосон = хамгийн ард)" type="number" min={1} value={form.position}
                  placeholder="Автомат"
                  onChange={(e) => setForm({ ...form, position: e.target.value })} />
                <p className="mt-1 text-xs text-gray-400">
                  Түвшин доторх дараалал — апп дээрх зам болон хичээлийн дугаар үүгээр эрэмбэлэгдэнэ.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Нийтлэх <span className="text-xs text-gray-400">(нийтлээгүй хичээл апп дээр харагдахгүй)</span>
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving} />

            {/* Per-lesson tests (4 categories) — needs a saved lesson id */}
            {modal === 'edit' && editing ? (
              <>
                <LessonWords lessonId={editing.id} />
                <LessonTests lessonId={editing.id} level={form.level} />
              </>
            ) : (
              <p className="text-xs text-gray-400">💡 Тест нэмэхийн тулд эхлээд хичээлээ хадгална уу.</p>
            )}
          </div>
        </Modal>
      )}

      {/* Media preview modal */}
      {modal === 'preview' && preview && (
        <Modal title={preview.title} onClose={() => { setModal(null); setPreview(null); }}>
          <div className="space-y-4">
            {(preview.thumbnailUrl ?? preview.content?.imageUrl) && (
              <div>
                <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Image className="h-3 w-3" /> Зураг</p>
                <img
                  src={preview.thumbnailUrl ?? preview.content?.imageUrl}
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
            {!preview.thumbnailUrl && !preview.content?.imageUrl && !preview.content?.videoUrl && (
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
