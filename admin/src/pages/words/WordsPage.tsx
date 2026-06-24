import { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, Plus, Pencil, Sparkles, Trash2, Upload, CheckSquare, XSquare, Send, AlertCircle } from 'lucide-react';
import { api, getToken } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

interface Word {
  id: string;
  english: string;
  mongolian: string;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  level: string;
  status: string;
  category: string | null;
  lessonId: string | null;
}

interface WordStats {
  total: number;
  byStatus: Record<string, number>;
  missingImage: number;
  missingAudio: number;
}

interface ImportReport {
  total: number;
  inserted: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
  duplicates: { row: number; word: string }[];
  missingImage: string[];
  missingAudio: string[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: '',             label: 'Бүгд' },
  { value: 'needs_review', label: '⏳ Хянах' },
  { value: 'approved',     label: '✅ Батлагдсан' },
  { value: 'published',    label: '🌐 Нийтлэгдсэн' },
  { value: 'rejected',     label: '❌ Буцаагдсан' },
  { value: 'draft',        label: '📝 Ноорог' },
];

const STATUS_COLORS: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  published: 'green', approved: 'blue', needs_review: 'yellow', rejected: 'red', draft: 'gray',
};
const STATUS_LABELS: Record<string, string> = {
  published: 'Нийтлэгдсэн', approved: 'Батлагдсан', needs_review: 'Хянах', rejected: 'Буцаагдсан', draft: 'Ноорог',
};

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

interface WordForm {
  english: string; mongolian: string; level: string;
  partOfSpeech: string; exampleSentence: string; exampleTranslation: string;
  imageUrl: string;
  generateImage: boolean;
}
const empty: WordForm = {
  english: '', mongolian: '', level: 'a1',
  partOfSpeech: '', exampleSentence: '', exampleTranslation: '',
  imageUrl: '', generateImage: true,
};

const CSV_TEMPLATE =
  'word,mongolian_meaning,level,part_of_speech,category,english_definition,english_example,mongolian_example,phonetic,image_url,audio_url\n' +
  'abandon,Орхих,a1,verb,Daily Life,to leave someone or something behind,He abandoned the old house.,Тэр хуучин байшинг орхисон.,/əˈbændən/,,\n';

// ── CSV parser ─────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result;
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<WordStats | null>(null);
  const [statusTab, setStatusTab] = useState('needs_review');
  const [levelFilter, setLevelFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  const [modal, setModal] = useState<null | 'create' | 'edit' | 'import'>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState<WordForm>(empty);
  const [saving, setSaving] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [error, setError] = useState('');

  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (statusTab) params.set('status', statusTab);
    if (levelFilter) params.set('level', levelFilter);
    const data = await api.get<{ items: Word[] }>(`/words?${params}`);
    setWords(data.items ?? []);
    setSelected(new Set());
  }, [statusTab, levelFilter]);

  const loadStats = useCallback(() => {
    api.get<WordStats>('/words/stats').then(setStats).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Form helpers ─────────────────────────────────────────────────────────

  function openCreate() { setForm(empty); setEditing(null); setError(''); setModal('create'); }
  function openEdit(w: Word) {
    setForm({
      english: w.english, mongolian: w.mongolian, level: w.level,
      partOfSpeech: w.partOfSpeech ?? '',
      exampleSentence: w.exampleSentence ?? '',
      exampleTranslation: w.exampleTranslation ?? '',
      imageUrl: '',
      generateImage: false,
    });
    setEditing(w); setError(''); setModal('edit');
  }

  async function aiFill() {
    if (!form.english.trim()) { setError('Эхлээд Англи үгийг оруулна уу'); return; }
    setAiFilling(true); setError('');
    try {
      const result = await api.post<{
        mongolian: string; partOfSpeech: string;
        exampleSentence: string; exampleTranslation: string; imageUrl: string | null;
      }>('/words/ai-fill', { english: form.english.trim() });
      setForm(f => ({
        ...f,
        mongolian: result.mongolian || f.mongolian,
        partOfSpeech: result.partOfSpeech || f.partOfSpeech,
        exampleSentence: result.exampleSentence || f.exampleSentence,
        exampleTranslation: result.exampleTranslation || f.exampleTranslation,
        imageUrl: result.imageUrl || f.imageUrl,
        generateImage: false,
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI алдаа гарлаа');
    } finally { setAiFilling(false); }
  }

  async function save() {
    if (!form.english.trim() || !form.mongolian.trim()) { setError('Англи болон Монгол үгийг оруулна уу'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        english: form.english, mongolian: form.mongolian, level: form.level,
        partOfSpeech: form.partOfSpeech || undefined,
        exampleSentence: form.exampleSentence || undefined,
        exampleTranslation: form.exampleTranslation || undefined,
        imageUrl: form.imageUrl || undefined,
        generateImage: form.generateImage || undefined,
      };
      if (modal === 'create') await api.post('/words', payload);
      else if (editing) await api.patch(`/words/${editing.id}`, payload);
      setModal(null); load(); loadStats();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Энэ үгийг устгах уу?')) return;
    await api.delete(`/words/${id}`);
    load(); loadStats();
  }

  async function generateImage(id: string) {
    setGeneratingId(id);
    try { await api.post(`/words/${id}/generate-image`, {}); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Зураг үүсгэхэд алдаа гарлаа'); }
    finally { setGeneratingId(null); }
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(prev => prev.size === words.length ? new Set() : new Set(words.map(w => w.id)));
  }

  async function bulkAction(status: string) {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} үгийн статусыг "${STATUS_LABELS[status]}" болгох уу?`)) return;
    setBulkLoading(true);
    try {
      await api.patch('/words/bulk', { ids: Array.from(selected), changes: { status } });
      load(); loadStats();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bulk алдаа');
    } finally { setBulkLoading(false); }
  }

  // ── Import v2 ─────────────────────────────────────────────────────────────

  async function handleImportFile(file: File) {
    setImporting(true); setImportError(''); setImportReport(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${BASE}/words/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken() ?? ''}` },
        body: formData,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message ?? `Алдаа ${res.status}`);
      setImportReport(body as ImportReport);
      load(); loadStats();
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Import алдаа');
    } finally { setImporting(false); }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'words_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadErrorReport() {
    if (!importReport) return;
    const rows = [
      ['Мөр', 'Талбар', 'Алдаа'],
      ...importReport.errors.map(e => [e.row, e.field, e.message]),
      ...importReport.duplicates.map(d => [d.row, 'word', `Давхардал: "${d.word}"`]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'import_errors.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  // ── Table ─────────────────────────────────────────────────────────────────

  const allSelected = words.length > 0 && selected.size === words.length;

  const columns = [
    {
      key: 'check', header: (
        <input type="checkbox" checked={allSelected} onChange={toggleAll}
          className="h-4 w-4 rounded border-gray-300 accent-primary" />
      ),
      render: (w: Word) => (
        <input type="checkbox" checked={selected.has(w.id)} onChange={() => toggleSelect(w.id)}
          className="h-4 w-4 rounded border-gray-300 accent-primary" onClick={e => e.stopPropagation()} />
      ),
      className: 'w-8',
    },
    {
      key: 'image', header: '', render: (w: Word) => (
        <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
          {w.imageUrl ? <img src={w.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-gray-300" />}
        </div>
      ),
    },
    {
      key: 'word', header: 'Үг', render: (w: Word) => (
        <div>
          <p className="font-medium">{w.english}</p>
          <p className="text-xs text-gray-400">{w.mongolian}</p>
          {w.exampleSentence && <p className="text-xs text-gray-300 truncate max-w-xs">{w.exampleSentence}</p>}
        </div>
      ),
    },
    {
      key: 'meta', header: 'Түвшин / Хэлзүй', render: (w: Word) => (
        <div className="flex flex-wrap gap-1">
          <Badge color={levelColors[w.level] ?? 'gray'}>{w.level.toUpperCase()}</Badge>
          {w.partOfSpeech && <span className="text-xs text-gray-400 italic">{w.partOfSpeech}</span>}
          {w.category && <span className="text-xs text-gray-300">{w.category}</span>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Статус', render: (w: Word) => (
        <Badge color={STATUS_COLORS[w.status] ?? 'gray'}>{STATUS_LABELS[w.status] ?? w.status}</Badge>
      ),
    },
    {
      key: 'actions', header: '', render: (w: Word) => (
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => generateImage(w.id)} disabled={generatingId === w.id} title="AI зураг үүсгэх">
            {generatingId === w.id
              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              : <Sparkles className="h-4 w-4 text-primary" />}
          </Button>
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
        title="Үгийн сан"
        description={stats ? `Нийт: ${stats.total} · Зураггүй: ${stats.missingImage} · Аудиогүй: ${stats.missingAudio}` : 'Үгийн сан'}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setModal('import'); setImportReport(null); setImportError(''); }}>
              <Upload className="h-4 w-4" /> Оруулах
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Үг нэмэх</Button>
          </div>
        }
      />

      {/* Stats row */}
      {stats && (
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setStatusTab(status)}
              className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${statusTab === status ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}
            >
              {STATUS_LABELS[status] ?? status}: {count}
            </button>
          ))}
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-3 border-b border-gray-200 overflow-x-auto">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setStatusTab(t.value)}
            className={`px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${statusTab === t.value ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto pb-1">
          <Select options={levelOptions} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-32 text-xs" />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.size} сонгосон</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => bulkAction('approved')} disabled={bulkLoading}>
              <CheckSquare className="h-4 w-4 text-blue-500" /> Батлах
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkAction('published')} disabled={bulkLoading}>
              <Send className="h-4 w-4 text-green-500" /> Нийтлэх
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulkAction('rejected')} disabled={bulkLoading}>
              <XSquare className="h-4 w-4 text-red-400" /> Буцаах
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>Болих</Button>
          </div>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <Table columns={columns} rows={words} keyFn={(w) => w.id} empty="Үг байхгүй байна" />

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Үг нэмэх' : 'Үг засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input label="Англи үг" value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} placeholder="apple" />
              </div>
              <button
                type="button"
                onClick={aiFill}
                disabled={aiFilling || !form.english.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primarySoft px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {aiFilling ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Sparkles className="h-4 w-4" />}
                {aiFilling ? 'Бөглөж байна...' : 'AI бөглөх'}
              </button>
            </div>

            <Input label="Монгол утга" value={form.mongolian} onChange={(e) => setForm({ ...form, mongolian: e.target.value })} placeholder="алим" />

            <div className="grid grid-cols-2 gap-4">
              <Select label="Түвшин" options={levelFormOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Input label="Хэлзүй (noun, verb...)" value={form.partOfSpeech} onChange={(e) => setForm({ ...form, partOfSpeech: e.target.value })} placeholder="noun" />
            </div>
            <Input label="Жишээ өгүүлбэр (Англи)" value={form.exampleSentence} onChange={(e) => setForm({ ...form, exampleSentence: e.target.value })} />
            <Input label="Жишээ өгүүлбэрийн орчуулга" value={form.exampleTranslation} onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })} />

            {form.imageUrl && (
              <div className="relative rounded-xl overflow-hidden border border-gray-200">
                <img src={form.imageUrl} alt={form.english} className="w-full max-h-40 object-cover" />
                <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: '', generateImage: false }))}
                  className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white hover:bg-black/70">
                  <span className="text-xs px-1">✕</span>
                </button>
                <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-xs text-white">AI зураг</span>
              </div>
            )}

            {!form.imageUrl && editing?.imageUrl && (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <img src={editing.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <p className="text-sm text-gray-500">Одоогийн зураг</p>
              </div>
            )}

            {!form.imageUrl && (
              <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.generateImage} onChange={(e) => setForm({ ...form, generateImage: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />
                  {modal === 'create' ? 'Зураг автоматаар үүсгэх' : 'Зургийг шинээр үүсгэх'}
                </span>
              </label>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Болих</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? (form.generateImage && !form.imageUrl ? 'Хадгалж, зураг үүсгэж байна...' : 'Хадгалж байна...') : 'Хадгалах'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal (v2 — with report) */}
      {modal === 'import' && (
        <Modal title="CSV оруулах (v2)" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
              <p className="font-medium mb-1">CSV баганын гарчиг (дэлгэрэнгүй формат):</p>
              <p className="text-xs font-mono bg-white rounded px-2 py-1 border border-gray-100 overflow-x-auto whitespace-nowrap">
                word, mongolian_meaning, level, part_of_speech, category, english_definition, english_example, mongolian_example, phonetic, image_url, audio_url
              </p>
              <p className="text-xs text-gray-400 mt-1">Шинэ үгс → <strong>needs_review</strong> статустай орно (автоматаар нийтлэгдэхгүй)</p>
              <button onClick={downloadCsvTemplate} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
                <Upload className="h-3 w-3 rotate-180" /> Загвар татах
              </button>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
            >
              {importing
                ? <div className="flex items-center gap-2 text-sm text-primary"><div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />Оруулж байна...</div>
                : <><Upload className="h-10 w-10 text-gray-300" /><p className="text-sm font-medium text-gray-700">CSV файл сонгох</p><p className="text-xs text-gray-400">Чирж оруулж болно</p></>
              }
              <input ref={fileRef} type="file" accept=".csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }} />
            </div>

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
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-red-700 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" /> {importReport.errors.length} алдаа
                      </p>
                      <button onClick={downloadErrorReport} className="text-xs text-red-600 hover:underline">CSV татах</button>
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {importReport.errors.slice(0, 5).map((e, i) => (
                        <p key={i} className="text-xs text-red-600">Мөр {e.row}: {e.message}</p>
                      ))}
                      {importReport.errors.length > 5 && <p className="text-xs text-red-400">...болон {importReport.errors.length - 5} бусад алдаа</p>}
                    </div>
                  </div>
                )}

                {importReport.duplicates.length > 0 && (
                  <p className="text-xs text-gray-500">🔁 {importReport.duplicates.length} давхардал алгасагдсан</p>
                )}
                {importReport.missingImage.length > 0 && (
                  <p className="text-xs text-gray-400">🖼 {importReport.missingImage.length} үгэнд зураг байхгүй</p>
                )}
                {importReport.missingAudio.length > 0 && (
                  <p className="text-xs text-gray-400">🔊 {importReport.missingAudio.length} үгэнд аудио байхгүй</p>
                )}
              </div>
            )}

            {importError && <p className="text-sm text-red-500">{importError}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
