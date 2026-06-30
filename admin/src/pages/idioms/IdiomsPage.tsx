import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Image as ImageIcon, Eye, EyeOff, Sparkles, Volume2, Upload, AlertCircle, Trash2 } from 'lucide-react';
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
import { Pagination } from '../../components/Pagination';

const LIMIT = 20;

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

/** Live progress of a background AI-bulk job (phrase list → AI fills everything). */
interface AiBulkReport {
  requested: number;
  inserted: number;
  skipped: number;
  failed: { phrase: string; message: string }[];
  background?: boolean;
  total?: number;
  processed?: number;
  done?: boolean;
  jobId?: string;
  canceled?: boolean;
}

/** Result of a CSV import with a row-by-row validation report. */
interface ImportReport {
  total: number;
  inserted: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
  duplicates: { row: number; phrase: string }[];
}

const IDIOM_CSV_TEMPLATE =
  'phrase,mongolian,meaning,definition,exampleSentence,exampleTranslation,imageUrl,audioUrl\n' +
  '"break the ice",мөсийг хайлуулах,"Анхны таагүй байдлыг арилгах","Шинэ хүмүүстэй танилцахад хэрэглэнэ","He told a joke to break the ice.","Тэр таагүй байдлыг арилгахын тулд онигоо ярьсан.",,\n';

/**
 * Pull English idioms out of a file for AI bulk import.
 * Accepts: JSON (string[] or {phrase}[]), CSV (first column), or a plain list
 * (one idiom per line). Idioms can contain commas, so only CSV splits on comma.
 */
function extractPhrases(name: string, text: string): string[] {
  if (name.endsWith('.json')) {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : j.phrases ?? j.idioms;
    return (arr ?? [])
      .map((x: unknown) => (typeof x === 'string' ? x : (x as { phrase?: string })?.phrase))
      .filter((p: unknown): p is string => !!p)
      .map((p: string) => p.trim());
  }
  const isCsv = name.endsWith('.csv');
  const lines = text
    .split(/\r?\n/)
    .map((l) => (isCsv ? l.split(',')[0] : l).replace(/^"|"$/g, '').trim())
    .filter(Boolean);
  // Drop a leading "phrase" header row if present.
  if (lines[0]?.toLowerCase() === 'phrase') lines.shift();
  return lines;
}

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [imageJob, setImageJob] = useState<ImageJob | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Anchor row index for shift-click range selection (like the Words page).
  const lastSelectedIndex = useRef<number | null>(null);
  // Whether Shift was held — captured on mousedown (change event lacks shiftKey).
  const shiftKeyRef = useRef(false);

  // Import (CSV or AI bulk)
  const [showImport, setShowImport] = useState(false);
  const [aiMode, setAiMode] = useState(true);
  const [aiImages, setAiImages] = useState(false);
  const [aiAudio, setAiAudio] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [aiReport, setAiReport] = useState<AiBulkReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bulkPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    let url = `/idioms?all=true&page=${page}&limit=${LIMIT}`;
    if (onlyNoImage) url += '&noImage=true';
    const data = await api.get<{ items: Idiom[]; total: number }>(url);
    setIdioms(data.items ?? []);
    setTotal(data.total ?? 0);
    setSelected(new Set());
  }, [onlyNoImage, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (bulkPollRef.current) clearTimeout(bulkPollRef.current);
  }, []);

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

  // ── Selection (mirrors the Words page: header select-all + shift-click range) ──
  /**
   * Select a row checkbox. Holding Shift selects the whole range between the
   * previously-clicked row and this one (like a file manager / Gmail).
   */
  function selectRow(index: number, shiftKey: boolean) {
    setSelected((s) => {
      const next = new Set(s);
      if (shiftKey && lastSelectedIndex.current !== null) {
        const [a, b] = [lastSelectedIndex.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) next.add(idioms[i].id);
      } else {
        const id = idioms[index].id;
        next.has(id) ? next.delete(id) : next.add(id);
      }
      return next;
    });
    lastSelectedIndex.current = index;
  }
  function toggleSelectAll() {
    lastSelectedIndex.current = null;
    setSelected((s) => (s.size === idioms.length ? new Set() : new Set(idioms.map((i) => i.id))));
  }

  // ── Bulk actions ──
  async function bulkPublish(isPublished: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true); setError('');
    try { await api.patch('/idioms/bulk', { ids: [...selected], isPublished }); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
    finally { setBulkBusy(false); }
  }

  async function bulkDelete() {
    if (selected.size === 0 || !confirm(`${selected.size} хэлц устгах уу?`)) return;
    setBulkBusy(true); setError('');
    try { await Promise.all([...selected].map((id) => api.delete(`/idioms/${id}`))); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
    finally { setBulkBusy(false); }
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

  // ── Import (CSV / AI bulk) ──
  function openImport() {
    setShowImport(true);
    setImportReport(null);
    setAiReport(null);
    setImportError('');
  }

  async function handleImportFile(file: File) {
    setImporting(true); setImportError(''); setImportReport(null);
    try {
      if (aiMode) {
        const text = await file.text();
        const phrases = extractPhrases(file.name, text);
        if (phrases.length === 0) throw new Error('Хэлц олдсонгүй');
        const body = await api.post<AiBulkReport & { jobId?: string; requested?: number }>(
          '/idioms/ai-bulk',
          { phrases, generateImages: aiImages, generateAudios: aiAudio },
        );
        const total = body.requested ?? phrases.length;
        setAiReport({ requested: total, inserted: 0, skipped: 0, failed: [], background: true, total, processed: 0, done: false, jobId: body.jobId });
        if (body.jobId) pollBulkJob(body.jobId);
        setShowImport(false); // progress shows on the main page
      } else {
        const formData = new FormData();
        formData.append('file', file);
        const body = await api.upload<ImportReport>('/idioms/import', formData);
        setImportReport(body);
        load();
      }
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Import алдаа');
    } finally { setImporting(false); }
  }

  /** Poll a background AI-bulk job for progress; refresh the list as it runs. */
  function pollBulkJob(jobId: string) {
    const tick = async () => {
      let stop = false;
      try {
        const job = await api.get<Partial<AiBulkReport> & { done?: boolean }>(`/idioms/ai-bulk/${jobId}`);
        setAiReport((prev) => ({
          ...(prev ?? { requested: 0, inserted: 0, skipped: 0, failed: [] }),
          ...job,
          jobId,
          background: true,
        } as AiBulkReport));
        load();
        if (job.done) { stop = true; }
      } catch {
        stop = true;
      }
      if (!stop) bulkPollRef.current = setTimeout(tick, 2500);
    };
    bulkPollRef.current = setTimeout(tick, 2000);
  }

  async function cancelBulkJob() {
    const jobId = aiReport?.jobId;
    if (!jobId) return;
    try {
      await api.post(`/idioms/ai-bulk/${jobId}/cancel`, {});
      setAiReport((prev) => (prev ? { ...prev, canceled: true } : prev));
    } catch { /* next poll will reflect state */ }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([IDIOM_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'idioms_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
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
      header: (
        <input type="checkbox" checked={allChecked} onChange={toggleSelectAll}
          className="h-4 w-4 rounded border-gray-300 accent-primary" />
      ),
      render: (it: Idiom) => (
        <input type="checkbox" checked={selected.has(it.id)}
          className="h-4 w-4 rounded border-gray-300 accent-primary"
          // Capture Shift on mousedown (the change event has no shiftKey); the
          // select itself runs in onChange which always fires on a toggle.
          onMouseDown={(e) => { shiftKeyRef.current = e.shiftKey; }}
          onClick={(e) => e.stopPropagation()}
          onChange={() => {
            window.getSelection()?.removeAllRanges();
            selectRow(idioms.findIndex((x) => x.id === it.id), shiftKeyRef.current);
          }} />
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
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={openImport}>
              <Upload className="h-4 w-4" /> Оруулах
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Хэлц нэмэх</Button>
          </div>
        }
      />

      {/* Filter bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button variant={onlyNoImage ? 'primary' : 'secondary'} size="sm" onClick={() => { setOnlyNoImage((v) => !v); setPage(1); }}>
          {onlyNoImage ? '✓ ' : ''}Зураггүй
        </Button>
      </div>

      {/* Bulk action bar (appears when rows are selected — like the Words page) */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primarySoft px-4 py-2 text-sm">
          <span className="font-medium text-primary">{selected.size} сонгосон:</span>
          <Button size="sm" onClick={() => bulkPublish(true)} disabled={bulkBusy}>Нийтлэх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(false)} disabled={bulkBusy}>Ноорог болгох</Button>
          <Button variant="secondary" size="sm" onClick={bulkGenerateImages} disabled={bulkBusy || (!!imageJob && !imageJob.done)} title="Сонгосон хэлцэд AI зураг үүсгэх">
            <ImageIcon className="h-4 w-4 text-primary" /> Зураг үүсгэх
          </Button>
          <Button variant="ghost" size="sm" onClick={bulkDelete} disabled={bulkBusy}>
            <Trash2 className="h-4 w-4 text-red-500" /> Устгах
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">Цуцлах</button>
        </div>
      )}

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

      {/* Background AI-bulk job progress — visible while you keep working */}
      {aiReport && aiReport.background && (() => {
        const jobTotal = aiReport.total ?? aiReport.requested ?? 0;
        const processed = aiReport.processed ?? 0;
        const pct = jobTotal ? Math.round((processed / jobTotal) * 100) : 0;
        return (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span>
                {aiReport.done
                  ? (aiReport.canceled ? '🛑 Зогсоосон' : '✅ AI боловсруулж дууслаа')
                  : (aiReport.canceled ? '🛑 Зогсоож байна…' : '⏳ AI хэлц боловсруулж байна (background)')}
              </span>
              {aiReport.done ? (
                <button onClick={() => setAiReport(null)} className="text-xs text-blue-500 hover:underline">Хаах</button>
              ) : (
                <button
                  onClick={cancelBulkJob}
                  disabled={aiReport.canceled}
                  className="rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {aiReport.canceled ? 'Зогсоож байна…' : 'Зогсоох'}
                </button>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs">
              {processed}/{jobTotal} ({pct}%) · амжилттай <strong>{aiReport.inserted}</strong>
              {aiReport.skipped > 0 && <> · давхардал {aiReport.skipped}</>}
              {' '}· алдаа {aiReport.failed.length}
            </p>
            {aiReport.failed.length > 0 && (
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer">{aiReport.failed.length} амжилтгүй</summary>
                <ul className="mt-1 list-disc pl-4">
                  {aiReport.failed.slice(0, 20).map((f) => (
                    <li key={f.phrase}>{f.phrase}: {f.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })()}

      <Table columns={columns} rows={idioms} keyFn={(i) => i.id} empty="Хэлц байхгүй" />
      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />

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

      {/* Import modal (CSV or AI bulk) */}
      {showImport && (
        <Modal size="lg" title="Хэлц оруулах" onClose={() => setShowImport(false)}>
          <div className="space-y-4">
            {/* Mode toggle */}
            <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primarySoft px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={aiMode} onChange={(e) => { setAiMode(e.target.checked); setImportReport(null); }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm text-gray-700">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Sparkles className="h-4 w-4" /> Зөвхөн англи хэлц — AI бусдыг бөглөнө
                </span>
                <span className="text-xs text-gray-500">
                  Англи хэлцийн жагсаалт оруулахад орчуулга, утга, тайлбар, жишээ зэргийг AI бөглөж бэлэн болгоно.
                </span>
              </span>
            </label>

            {/* Instructions */}
            {aiMode ? (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">Формат: мөр бүрт нэг хэлц (эсвэл CSV/JSON):</p>
                <p className="text-xs text-gray-500 font-mono bg-white rounded px-2 py-1 border border-gray-100 whitespace-pre">break the ice{'\n'}hit the books{'\n'}piece of cake</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={aiImages} onChange={(e) => setAiImages(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4 text-primary" /> Зураг бас үүсгэх (удаан)</span>
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={aiAudio} onChange={(e) => setAiAudio(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="flex items-center gap-1.5"><Volume2 className="h-4 w-4 text-primary" /> Дуудлага бас үүсгэх (удаан)</span>
                </label>
                <p className="mt-1 text-xs text-gray-400">Шинэ хэлцүүд → ноорог болж нэмэгдэнэ.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">CSV баганын гарчиг:</p>
                <p className="text-xs text-gray-500 font-mono bg-white rounded px-2 py-1 border border-gray-100 overflow-x-auto whitespace-nowrap">
                  phrase, mongolian, meaning, definition, exampleSentence, exampleTranslation, imageUrl, audioUrl
                </p>
                <p className="mt-1 text-xs text-gray-400">Зөвхөн <strong>phrase, mongolian</strong> шаардлагатай. Шинэ хэлцүүд → ноорог.</p>
                <button onClick={downloadCsvTemplate} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
                  <Upload className="h-3 w-3 rotate-180" /> Загвар татах
                </button>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {importing ? (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  {aiMode ? 'Эхлүүлж байна...' : 'Оруулж байна...'}
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">Файл сонгох</p>
                  <p className="text-xs text-gray-400">{aiMode ? '.csv · .json · .txt' : '.csv'} · чирж оруулж болно</p>
                </>
              )}
              <input ref={fileRef} type="file" accept={aiMode ? '.csv,.json,.txt' : '.csv'} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
            </div>

            {/* CSV import report */}
            {importReport && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                    <p className="text-xl font-bold text-green-700">{importReport.inserted}</p>
                    <p className="text-xs text-green-600">Нэмэгдсэн</p>
                  </div>
                  <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-center">
                    <p className="text-xl font-bold text-yellow-700">{importReport.skipped}</p>
                    <p className="text-xs text-yellow-600">Алгасагдсан</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
                    <p className="text-xl font-bold text-gray-700">{importReport.total}</p>
                    <p className="text-xs text-gray-500">Нийт мөр</p>
                  </div>
                </div>
                {importReport.errors.length > 0 && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-sm font-medium text-red-700 flex items-center gap-1 mb-2">
                      <AlertCircle className="h-4 w-4" /> {importReport.errors.length} алдаа
                    </p>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {importReport.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-red-600">Мөр {e.row}: {e.message}</p>
                      ))}
                      {importReport.errors.length > 5 && <p className="text-xs text-red-400">...болон {importReport.errors.length - 5} бусад</p>}
                    </div>
                  </div>
                )}
                {importReport.duplicates.length > 0 && <p className="text-xs text-gray-500">🔁 {importReport.duplicates.length} давхардал алгасагдсан</p>}
              </div>
            )}

            {importError && <p className="text-sm text-red-500">{importError}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
