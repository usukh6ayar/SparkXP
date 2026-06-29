import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Image as ImageIcon, Eye, EyeOff, Sparkles, Volume2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { ImageCropUpload } from '../../components/ImageCropUpload';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';

interface Idiom {
  id: string;
  phrase: string;
  mongolian: string;
  meaning?: string | null;
  definition?: string | null;
  exampleSentence?: string | null;
  exampleTranslation?: string | null;
  imageUrl?: string | null;
  audioUrl?: string | null;
  isPublished: boolean;
}

interface IdiomForm {
  phrase: string;
  mongolian: string;
  meaning: string;
  definition: string;
  exampleSentence: string;
  exampleTranslation: string;
  imageUrl: string;
  audioUrl: string;
  isPublished: boolean;
}
const emptyForm: IdiomForm = {
  phrase: '', mongolian: '', meaning: '', definition: '',
  exampleSentence: '', exampleTranslation: '', imageUrl: '', audioUrl: '', isPublished: false,
};

interface ImageJob { total: number; processed: number; ok?: number; failed?: number; done: boolean }

function TextArea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <textarea
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function IdiomsPage() {
  const [idioms, setIdioms] = useState<Idiom[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Idiom | null>(null);
  const [form, setForm] = useState<IdiomForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filling, setFilling] = useState(false);
  const [genAudio, setGenAudio] = useState(false);
  const [error, setError] = useState('');

  // Bulk: selection, "no image" filter, image job
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [onlyNoImage, setOnlyNoImage] = useState(false);
  const [imageJob, setImageJob] = useState<ImageJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    let url = '/idioms?all=true&limit=500';
    if (onlyNoImage) url += '&noImage=true';
    const data = await api.get<{ items: Idiom[] }>(url);
    setIdioms(data.items ?? []);
    setSelected(new Set());
  }, [onlyNoImage]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function openCreate() { setForm(emptyForm); setEditing(null); setError(''); setModal('create'); }
  function openEdit(it: Idiom) {
    setForm({
      phrase: it.phrase, mongolian: it.mongolian,
      meaning: it.meaning ?? '', definition: it.definition ?? '',
      exampleSentence: it.exampleSentence ?? '', exampleTranslation: it.exampleTranslation ?? '',
      imageUrl: it.imageUrl ?? '', audioUrl: it.audioUrl ?? '', isPublished: it.isPublished,
    });
    setEditing(it); setError(''); setModal('edit');
  }

  // ── Selection ──
  function toggleRow(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((s) => (s.size === idioms.length ? new Set() : new Set(idioms.map((i) => i.id))));
  }

  // ── Bulk actions ──
  async function bulkPublish(isPublished: boolean) {
    await api.patch('/idioms/bulk', { ids: [...selected], isPublished });
    load();
  }

  async function bulkGenerateImages() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setError('');
    try {
      const { jobId } = await api.post<{ jobId: string }>('/idioms/bulk-generate-images', { ids });
      setImageJob({ total: ids.length, processed: 0, done: false });
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.get<ImageJob & { expired?: boolean }>(`/idioms/image-job/${jobId}`);
          setImageJob(job);
          if (job.done || job.expired) {
            if (pollRef.current) clearInterval(pollRef.current);
            setTimeout(() => setImageJob(null), 2500);
            load();
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Зураг үүсгэхэд алдаа');
    }
  }

  // ── Form: AI fill / audio / save ──
  async function aiFill() {
    if (!form.phrase.trim()) { setError('Эхлээд хэлц бичнэ үү'); return; }
    setFilling(true); setError('');
    try {
      const r = await api.post<{ mongolian: string; meaning: string; definition: string; exampleSentence: string; exampleTranslation: string }>(
        '/idioms/ai-fill', { phrase: form.phrase.trim() },
      );
      setForm((f) => ({
        ...f,
        mongolian: r.mongolian || f.mongolian,
        meaning: r.meaning || f.meaning,
        definition: r.definition || f.definition,
        exampleSentence: r.exampleSentence || f.exampleSentence,
        exampleTranslation: r.exampleTranslation || f.exampleTranslation,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI бөглөхөд алдаа');
    } finally { setFilling(false); }
  }

  async function generateAudio() {
    if (!editing) return;
    setGenAudio(true); setError('');
    try {
      const { audioUrl } = await api.post<{ audioUrl: string }>(`/idioms/${editing.id}/generate-audio`, {});
      setForm((f) => ({ ...f, audioUrl }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Аудио үүсгэхэд алдаа');
    } finally { setGenAudio(false); }
  }

  async function save() {
    if (!form.phrase.trim() || !form.mongolian.trim()) { setError('Хэлц ба монгол утга шаардлагатай'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        phrase: form.phrase.trim(),
        mongolian: form.mongolian.trim(),
        meaning: form.meaning || undefined,
        definition: form.definition || undefined,
        exampleSentence: form.exampleSentence || undefined,
        exampleTranslation: form.exampleTranslation || undefined,
        imageUrl: form.imageUrl || undefined,
        audioUrl: form.audioUrl || undefined,
        isPublished: form.isPublished,
      };
      if (modal === 'create') await api.post('/idioms', payload);
      else if (editing) await api.patch(`/idioms/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function togglePublish(it: Idiom) {
    await api.patch(`/idioms/${it.id}`, { isPublished: !it.isPublished });
    load();
  }
  async function remove(id: string) {
    if (!confirm('Хэлц устгах уу?')) return;
    await api.delete(`/idioms/${id}`);
    load();
  }

  const allChecked = idioms.length > 0 && selected.size === idioms.length;

  const columns = [
    {
      key: 'sel',
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} />,
      render: (it: Idiom) => (
        <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleRow(it.id)} />
      ),
      className: 'w-8',
    },
    {
      key: 'img', header: '',
      render: (it: Idiom) => it.imageUrl
        ? <img src={it.imageUrl} alt="" className="h-10 w-14 rounded object-cover border border-gray-200" />
        : <div className="flex h-10 w-14 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50"><ImageIcon className="h-4 w-4 text-gray-300" /></div>,
      className: 'w-16',
    },
    { key: 'phrase', header: 'Хэлц', render: (it: Idiom) => <span className="font-medium">{it.phrase}</span> },
    { key: 'mongolian', header: 'Монгол', render: (it: Idiom) => <span className="text-gray-600">{it.mongolian}</span> },
    { key: 'audio', header: '🔊', render: (it: Idiom) => it.audioUrl ? <Volume2 className="h-4 w-4 text-primary" /> : <span className="text-gray-300">—</span> },
    {
      key: 'status', header: 'Төлөв',
      render: (it: Idiom) => (
        <button onClick={() => togglePublish(it)} title="Дарж нийтлэх төлөв солих">
          {it.isPublished ? <Badge color="green">Нийтэлсэн</Badge> : <Badge color="gray">Ноорог</Badge>}
        </button>
      ),
    },
    {
      key: 'actions', header: '',
      render: (it: Idiom) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => togglePublish(it)} title={it.isPublished ? 'Нийтлэхээ болих' : 'Нийтлэх'}>
            {it.isPublished ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-green-600" />}
          </Button>
          <RowActions onEdit={() => openEdit(it)} onDelete={() => remove(it.id)} />
        </div>
      ),
      className: 'text-right',
    },
  ];

  const publishedCount = idioms.filter((i) => i.isPublished).length;
  const noImageCount = idioms.filter((i) => !i.imageUrl).length;
  const imagePct = imageJob && imageJob.total ? Math.round((imageJob.processed / imageJob.total) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Хэлц үг"
        description={`Нийт: ${idioms.length} · Нийтэлсэн: ${publishedCount} · Зураггүй: ${noImageCount}`}
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Хэлц нэмэх</Button>}
      />

      {/* Filter + bulk bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant={onlyNoImage ? 'primary' : 'secondary'} size="sm" onClick={() => setOnlyNoImage((v) => !v)}>
          {onlyNoImage ? '✓ ' : ''}Зураггүй
        </Button>
        {idioms.length > 0 && (
          <Button variant="secondary" size="sm" onClick={toggleAll}>
            {allChecked ? 'Сонголт цуцлах' : 'Бүгдийг сонгох'}
          </Button>
        )}
        {selected.size > 0 && (
          <>
            <span className="text-sm text-gray-500">{selected.size} сонгосон:</span>
            <Button variant="secondary" size="sm" onClick={() => bulkPublish(true)}>Нийтлэх</Button>
            <Button variant="secondary" size="sm" onClick={() => bulkPublish(false)}>Ноорог болгох</Button>
            <Button size="sm" onClick={bulkGenerateImages} disabled={!!imageJob && !imageJob.done}>
              <ImageIcon className="h-4 w-4" /> Зураг үүсгэх ({selected.size})
            </Button>
          </>
        )}
      </div>

      {imageJob && (
        <div className="mb-3">
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${imagePct}%` }} />
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {imageJob.done ? '✓ Дууссан' : `Зураг үүсгэж байна… ${imageJob.processed}/${imageJob.total}`}
          </p>
        </div>
      )}

      <Table columns={columns} rows={idioms} keyFn={(i) => i.id} empty="Хэлц байхгүй" />

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Хэлц нэмэх' : 'Хэлц засах'} onClose={() => setModal(null)} size="xl">
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <Input wrapperClassName="flex-1" label="Хэлц (English)" placeholder="break the ice" value={form.phrase} onChange={(e) => setForm({ ...form, phrase: e.target.value })} />
              <Button variant="secondary" onClick={aiFill} disabled={filling}>
                <Sparkles className="h-4 w-4" /> {filling ? 'Бөглөж байна...' : 'AI-аар бөглөх'}
              </Button>
            </div>
            <Input label="Монгол орчуулга" value={form.mongolian} onChange={(e) => setForm({ ...form, mongolian: e.target.value })} />
            <TextArea label="Жинхэнэ утга (бодит санаа)" value={form.meaning} onChange={(v) => setForm({ ...form, meaning: v })} />
            <TextArea label="Тайлбар (хэрэглээ)" value={form.definition} onChange={(v) => setForm({ ...form, definition: v })} />
            <TextArea label="Жишээ өгүүлбэр (English)" value={form.exampleSentence} onChange={(v) => setForm({ ...form, exampleSentence: v })} />
            <TextArea label="Жишээний орчуулга" value={form.exampleTranslation} onChange={(v) => setForm({ ...form, exampleTranslation: v })} />
            <ImageCropUpload label="Зураг (заавал биш)" value={form.imageUrl} onChange={(url) => setForm({ ...form, imageUrl: url })} />

            <div className="flex items-center gap-3">
              {modal === 'edit' ? (
                <Button variant="secondary" size="sm" onClick={generateAudio} disabled={genAudio}>
                  <Volume2 className="h-4 w-4" /> {genAudio ? 'Үүсгэж байна...' : 'Дуу үүсгэх'}
                </Button>
              ) : (
                <span className="text-xs text-gray-400">💡 Дуу/зураг үүсгэхийн тулд эхлээд хадгална уу.</span>
              )}
              {form.audioUrl && (
                <button onClick={() => { new Audio(form.audioUrl).play(); }} title="Сонсох" className="text-primary">
                  <Volume2 className="h-5 w-5" />
                </button>
              )}
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
    </>
  );
}
