import { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, Plus, Pencil, Sparkles, Trash2, Upload } from 'lucide-react';
import { api, getToken } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { ImageCropUpload } from '../../components/ImageCropUpload';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

interface Word {
  id: string;
  english: string;
  mongolian: string;
  englishDefinition: string | null;
  phonetic: string | null;
  category: string | null;
  sparkTip: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  imageUrl: string | null;
  level: string;
  status: string;
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

// Review status — labels, colors and the filter/form option lists.
const statusMeta: Record<string, { label: string; color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' }> = {
  draft: { label: 'Ноорог', color: 'gray' },
  needs_review: { label: 'Хянах', color: 'yellow' },
  approved: { label: 'Зөвшөөрсөн', color: 'blue' },
  rejected: { label: 'Татгалзсан', color: 'red' },
  published: { label: 'Нийтэлсэн', color: 'green' },
};
const statusFilterOptions = [
  { value: '', label: 'Бүх төлөв' },
  ...Object.entries(statusMeta).map(([value, m]) => ({ value, label: m.label })),
];
const statusFormOptions = Object.entries(statusMeta).map(([value, m]) => ({ value, label: m.label }));

interface WordForm {
  english: string; mongolian: string; level: string; status: string;
  englishDefinition: string; phonetic: string; category: string; sparkTip: string;
  partOfSpeech: string; exampleSentence: string; exampleTranslation: string;
  imageUrl: string;      // AI-fill preview (returned from /words/ai-fill)
  generateImage: boolean; // checkbox: generate server-side after save
}
const empty: WordForm = {
  english: '', mongolian: '', level: 'a1', status: 'published',
  englishDefinition: '', phonetic: '', category: '', sparkTip: '',
  partOfSpeech: '', exampleSentence: '', exampleTranslation: '',
  imageUrl: '', generateImage: true,
};

const VALID_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];

const CSV_TEMPLATE =
  'english,mongolian,level,partOfSpeech,exampleSentence,exampleTranslation\n' +
  'apple,алим,a1,noun,I eat an apple every day.,Би өдөр бүр нэг алим иддэг.\n' +
  'run,гүйх,a1,verb,She runs in the park.,Тэр цэцэрлэгт гүйдэг.\n';

/** Parse a CSV string into word objects. Handles quoted fields. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  return lines.slice(1).map(line => {
    const vals = splitCsvLine(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').trim(); });
    return obj;
  }).filter(o => o['english']);
}

interface AiBulkReport {
  requested: number;
  inserted: number;
  skipped: number;
  failed: { word: string; message: string }[];
}

/**
 * Pull a list of English words out of an uploaded file for AI bulk import.
 * Accepts: CSV with an `english` column, JSON (array of strings or {english}),
 * or a plain list (one word per line / first CSV column).
 */
function extractEnglish(name: string, text: string): string[] {
  if (name.endsWith('.json')) {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : j.words;
    return (arr ?? [])
      .map((x: unknown) => (typeof x === 'string' ? x : (x as { english?: string })?.english))
      .filter((w: unknown): w is string => !!w)
      .map((w: string) => w.trim());
  }
  if (name.endsWith('.csv')) {
    const rows = parseCsv(text);
    if (rows.length && rows[0]['english'] !== undefined) {
      return rows.map((r) => r['english']?.trim()).filter(Boolean);
    }
  }
  // plain list / header-less CSV: take the first cell of each line
  return text
    .split(/\r?\n/)
    .map((l) => l.split(',')[0].trim())
    .filter((l) => l && l.toLowerCase() !== 'english');
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result;
}

interface WordStats {
  total: number;
  byStatus: Record<string, number>;
  missingImage: number;
  missingAudio: number;
  missingMnExample: number;
  duplicates: number;
}

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<WordStats | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'import'>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState<WordForm>(empty);
  const [saving, setSaving] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  // AI bulk: import a list of bare English words → AI fills the rest.
  const [aiMode, setAiMode] = useState(false);
  const [aiImages, setAiImages] = useState(false);
  const [aiReport, setAiReport] = useState<AiBulkReport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (statusFilter) params.set('status', statusFilter);
    else params.set('all', 'true'); // admin sees every status by default
    if (levelFilter) params.set('level', levelFilter);
    if (search.trim()) params.set('search', search.trim());
    const data = await api.get<{ items: Word[]; total: number }>(`/words?${params}`);
    setWords(data.items ?? []);
    setSelected(new Set());
    api.get<WordStats>('/words/stats').then(setStats).catch(() => {});
  }, [levelFilter, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected((s) => (s.size === words.length ? new Set() : new Set(words.map((w) => w.id))));
  }

  async function changeStatus(id: string, status: string) {
    try { await api.patch(`/words/${id}`, { status }); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
  }

  async function bulkStatus(status: string) {
    if (selected.size === 0) return;
    setBulkBusy(true); setError('');
    try { await api.patch('/words/bulk', { ids: [...selected], changes: { status } }); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
    finally { setBulkBusy(false); }
  }

  async function bulkDelete() {
    if (selected.size === 0 || !confirm(`${selected.size} үг устгах уу?`)) return;
    setBulkBusy(true); setError('');
    try { await Promise.all([...selected].map((id) => api.delete(`/words/${id}`))); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
    finally { setBulkBusy(false); }
  }

  function openCreate() { setForm(empty); setEditing(null); setError(''); setModal('create'); }
  function openEdit(w: Word) {
    setForm({
      english: w.english, mongolian: w.mongolian, level: w.level, status: w.status,
      englishDefinition: w.englishDefinition ?? '',
      phonetic: w.phonetic ?? '',
      category: w.category ?? '',
      sparkTip: w.sparkTip ?? '',
      partOfSpeech: w.partOfSpeech ?? '',
      exampleSentence: w.exampleSentence ?? '',
      exampleTranslation: w.exampleTranslation ?? '',
      imageUrl: w.imageUrl ?? '',   // show existing image so it can be replaced
      generateImage: false,
    });
    setEditing(w); setError(''); setModal('edit');
  }

  async function aiFill() {
    if (!form.english.trim()) { setError('Эхлээд Англи үгийг оруулна уу'); return; }
    setAiFilling(true); setError('');
    try {
      const result = await api.post<{
        mongolian: string; englishDefinition: string; phonetic: string;
        partOfSpeech: string; category: string; level: string;
        exampleSentence: string; exampleTranslation: string;
        sparkTip: string; imageUrl: string | null;
      }>('/words/ai-fill', { english: form.english.trim() });
      const level = VALID_LEVELS.includes((result.level || '').toLowerCase())
        ? result.level.toLowerCase()
        : form.level;
      setForm(f => ({
        ...f,
        mongolian: result.mongolian || f.mongolian,
        englishDefinition: result.englishDefinition || f.englishDefinition,
        phonetic: result.phonetic || f.phonetic,
        partOfSpeech: result.partOfSpeech || f.partOfSpeech,
        category: result.category || f.category,
        level,
        exampleSentence: result.exampleSentence || f.exampleSentence,
        exampleTranslation: result.exampleTranslation || f.exampleTranslation,
        sparkTip: result.sparkTip || f.sparkTip,
        imageUrl: result.imageUrl || f.imageUrl,
        generateImage: false, // already generated, uncheck server-side gen
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI алдаа гарлаа');
    } finally { setAiFilling(false); }
  }

  async function save() {
    if (!form.english.trim() || !form.mongolian.trim()) {
      setError('Англи болон Монгол үгийг оруулна уу'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        english: form.english,
        mongolian: form.mongolian,
        englishDefinition: form.englishDefinition || undefined,
        phonetic: form.phonetic || undefined,
        category: form.category || undefined,
        sparkTip: form.sparkTip || undefined,
        level: form.level,
        status: form.status,
        partOfSpeech: form.partOfSpeech || undefined,
        exampleSentence: form.exampleSentence || undefined,
        exampleTranslation: form.exampleTranslation || undefined,
        imageUrl: form.imageUrl || undefined,
        generateImage: form.generateImage || undefined,
      };
      if (modal === 'create') await api.post('/words', payload);
      else if (editing) await api.patch(`/words/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Энэ үгийг устгах уу?')) return;
    await api.delete(`/words/${id}`);
    load();
  }

  async function generateImage(id: string) {
    setGeneratingId(id); setError('');
    try {
      await api.post(`/words/${id}/generate-image`, {});
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Зураг үүсгэхэд алдаа гарлаа');
    } finally { setGeneratingId(null); }
  }

  async function handleImportFile(file: File) {
    setImporting(true); setError(''); setImportResult(null); setAiReport(null);
    try {
      const text = await file.text();

      // AI mode: a list of bare English words → AI fills everything.
      if (aiMode) {
        const englishList = extractEnglish(file.name, text);
        if (englishList.length === 0) throw new Error('Англи үг олдсонгүй');
        const res = await fetch(`${BASE}/words/ai-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
          body: JSON.stringify({ words: englishList, generateImages: aiImages }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message ?? `Алдаа ${res.status}`);
        }
        setAiReport(await res.json());
        load();
        return;
      }

      let words: Record<string, string>[];

      if (file.name.endsWith('.csv')) {
        words = parseCsv(text);
        if (words.length === 0) throw new Error('CSV файл хоосон байна эсвэл формат буруу байна');
      } else {
        const json = JSON.parse(text);
        words = Array.isArray(json) ? json : json.words;
        if (!Array.isArray(words)) throw new Error('JSON файл { words: [...] } хэлбэрт байх ёстой');
      }

      const res = await fetch(`${BASE}/words/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken() ?? ''}` },
        body: JSON.stringify({ words }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Алдаа ${res.status}`);
      }
      const result = await res.json();
      setImportResult(result);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Import алдаа');
    } finally { setImporting(false); }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'words_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const columns = [
    {
      key: 'select', header: '', render: (w: Word) => (
        <input
          type="checkbox"
          checked={selected.has(w.id)}
          onChange={() => toggleSelect(w.id)}
          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
      ),
    },
    {
      key: 'image', header: '', render: (w: Word) => (
        <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
          {w.imageUrl ? (
            <img src={w.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-gray-300" />
          )}
        </div>
      ),
    },
    {
      key: 'word', header: 'Үг', render: (w: Word) => (
        <div>
          <p className="font-medium">{w.english}</p>
          {w.exampleSentence && (
            <p className="text-xs text-gray-400 truncate max-w-xs">{w.exampleSentence}</p>
          )}
        </div>
      ),
    },
    {
      key: 'mongolian', header: 'Монгол утга', render: (w: Word) => (
        <div>
          <p>{w.mongolian}</p>
          {w.exampleTranslation && (
            <p className="text-xs text-gray-400 truncate max-w-xs">{w.exampleTranslation}</p>
          )}
        </div>
      ),
    },
    {
      key: 'pos', header: 'Хэлзүй', render: (w: Word) =>
        w.partOfSpeech ? <span className="text-xs text-gray-500 italic">{w.partOfSpeech}</span> : <span className="text-gray-300">—</span>,
    },
    {
      key: 'level', header: 'Түвшин', render: (w: Word) => (
        <Badge color={levelColors[w.level] ?? 'gray'}>{w.level.toUpperCase()}</Badge>
      ),
    },
    {
      key: 'status', header: 'Төлөв', render: (w: Word) => (
        <div className="flex items-center gap-2">
          <Badge color={statusMeta[w.status]?.color ?? 'gray'}>{statusMeta[w.status]?.label ?? w.status}</Badge>
          {w.status !== 'published' && (
            <button
              onClick={() => changeStatus(w.id, 'published')}
              className="text-xs text-primary hover:underline"
              title="Нийтлэх"
            >
              Нийтлэх
            </button>
          )}
        </div>
      ),
    },
    {
      key: 'actions', header: '', render: (w: Word) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => generateImage(w.id)}
            disabled={generatingId === w.id}
            title="Зураг үүсгэх"
          >
            {generatingId === w.id ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : (
              <Sparkles className="h-4 w-4 text-primary" />
            )}
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
        title="Үгс"
        description={`Нийт: ${words.length} үг`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setModal('import'); setImportResult(null); setError(''); }}>
              <Upload className="h-4 w-4" /> Төхөөрөмжөөс оруулах
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Үг нэмэх</Button>
          </div>
        }
      />

      {/* Stats bar */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: 'Нийт', value: stats.total, color: 'text-gray-800' },
            { label: 'Нийтэлсэн', value: stats.byStatus.published ?? 0, color: 'text-green-600' },
            { label: 'Хянах', value: stats.byStatus.needs_review ?? 0, color: 'text-yellow-600' },
            { label: 'Зураггүй', value: stats.missingImage, color: 'text-gray-500' },
            { label: 'Аудиогүй', value: stats.missingAudio, color: 'text-gray-500' },
            { label: 'Давхардал', value: stats.duplicates, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <p className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select options={statusFilterOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40" />
        <Select options={levelOptions} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-40" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Хайх (англи/монгол)…" className="w-56" />
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={words.length > 0 && selected.size === words.length}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          Бүгдийг сонгох
        </label>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primarySoft px-4 py-2 text-sm">
          <span className="font-medium text-primary">{selected.size} сонгосон:</span>
          <Button size="sm" onClick={() => bulkStatus('published')} disabled={bulkBusy}>Нийтлэх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkStatus('approved')} disabled={bulkBusy}>Зөвшөөрөх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkStatus('rejected')} disabled={bulkBusy}>Татгалзах</Button>
          <Button variant="ghost" size="sm" onClick={bulkDelete} disabled={bulkBusy}><Trash2 className="h-4 w-4 text-red-500" /> Устгах</Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">Цуцлах</button>
        </div>
      )}

      <Table columns={columns} rows={words} keyFn={(w) => w.id} empty="Үг байхгүй байна" />

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Үг нэмэх' : 'Үг засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {/* English word + AI fill button */}
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input label="Англи үг" value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} placeholder="apple" />
              </div>
              <button
                type="button"
                onClick={aiFill}
                disabled={aiFilling || !form.english.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primarySoft px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                title="AI-аар орчуулга, жишээ өгүүлбэр, зураг автоматаар бөглөх"
              >
                {aiFilling ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {aiFilling ? 'Бөглөж байна...' : 'AI бөглөх'}
              </button>
            </div>

            <p className="-mt-1 flex items-center gap-1.5 text-xs text-gray-400">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Зөвхөн Англи үгээ бичээд <span className="font-medium text-primary">AI бөглөх</span> дарвал доорх бүх талбар автоматаар бөглөгдөнө.
            </p>

            <Input label="Монгол утга" value={form.mongolian} onChange={(e) => setForm({ ...form, mongolian: e.target.value })} placeholder="алим" />
            <Input label="Англи тодорхойлолт" value={form.englishDefinition} onChange={(e) => setForm({ ...form, englishDefinition: e.target.value })} placeholder="to leave someone or something behind" />

            <div className="grid grid-cols-2 gap-4">
              <Select label="Түвшин" options={levelFormOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Select label="Төлөв" options={statusFormOptions} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
            </div>
            <Input label="Хэлзүй (noun, verb...)" value={form.partOfSpeech} onChange={(e) => setForm({ ...form, partOfSpeech: e.target.value })} placeholder="noun" />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Дуудлага (phonetic)" value={form.phonetic} onChange={(e) => setForm({ ...form, phonetic: e.target.value })} placeholder="/əˈbændən/" />
              <Input label="Ангилал (category)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Daily Life" />
            </div>
            <Input label="Жишээ өгүүлбэр (Англи)" value={form.exampleSentence} onChange={(e) => setForm({ ...form, exampleSentence: e.target.value })} placeholder="I eat an apple every day." />
            <Input label="Жишээ өгүүлбэрийн орчуулга" value={form.exampleTranslation} onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })} placeholder="Би өдөр бүр нэг алим иддэг." />
            <Input label="Spark сануулга (тогтооход туслах)" value={form.sparkTip} onChange={(e) => setForm({ ...form, sparkTip: e.target.value })} placeholder="Abandon = A band on? Хамтлаг чамайг орхиод явж байна гэж сана." />

            {/* Image — manual upload/crop/replace. Works for AI-filled images too
                (the AI fill / generate fills `imageUrl`, which shows here and can
                be swapped or cleared). */}
            <div className="space-y-2">
              <ImageCropUpload
                value={form.imageUrl}
                onChange={(url) => setForm(f => ({ ...f, imageUrl: url, generateImage: false }))}
                label="Зураг"
                aspect={1}
              />
              {form.imageUrl && (
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <ImageIcon className="h-3.5 w-3.5" />
                  Зургийг солихын тулд дээр дарж шинээр сонгоно уу.
                </p>
              )}

              {/* No image yet → offer AI auto-generation on save */}
              {!form.imageUrl && (
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.generateImage}
                    onChange={(e) => setForm({ ...form, generateImage: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Зураг оруулаагүй бол AI-аар автоматаар үүсгэх
                  </span>
                </label>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Болих</Button>
              <Button onClick={save} disabled={saving}>
                {saving
                  ? (form.generateImage && !form.imageUrl ? 'Хадгалж, зураг үүсгэж байна...' : 'Хадгалж байна...')
                  : 'Хадгалах'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {modal === 'import' && (
        <Modal title="Төхөөрөмжөөс үг оруулах" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {/* Mode toggle: AI fill vs full file */}
            <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primarySoft px-4 py-3 cursor-pointer">
              <input
                type="checkbox"
                checked={aiMode}
                onChange={(e) => { setAiMode(e.target.checked); setImportResult(null); setAiReport(null); }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-gray-700">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Sparkles className="h-4 w-4" /> Зөвхөн англи үгс — AI бусдыг бөглөнө
                </span>
                <span className="text-xs text-gray-500">
                  Англи үгсийн жагсаалт оруулахад орчуулга, тодорхойлолт, жишээ, түвшин гэх мэт бүгдийг AI бөглөж бэлэн болгоно.
                </span>
              </span>
            </label>

            {/* Instructions (depend on mode) */}
            {aiMode ? (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">Формат: мөр бүрт нэг англи үг (эсвэл `english` баганатай CSV / JSON):</p>
                <p className="text-xs text-gray-500 font-mono bg-white rounded px-2 py-1 border border-gray-100 whitespace-pre">abandon{'\n'}ability{'\n'}achieve</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={aiImages} onChange={(e) => setAiImages(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4 text-primary" /> Зураг бас үүсгэх (удаан · нэг удаад цөөн үг)</span>
                </label>
                <p className="mt-1 text-xs text-gray-400">Нэг удаад {aiImages ? '25' : '75'}-аас ихгүй үг. Их бол багцлан оруулна уу.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">CSV формат (Excel-д нээж засах боломжтой):</p>
                <p className="text-xs text-gray-500 font-mono bg-white rounded px-2 py-1 border border-gray-100 overflow-x-auto whitespace-nowrap">
                  english, mongolian, level, partOfSpeech, exampleSentence, exampleTranslation
                </p>
                <button
                  onClick={downloadCsvTemplate}
                  className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Upload className="h-3 w-3 rotate-180" /> Загвар татах (words_template.csv)
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
                  {aiMode ? 'AI бөглөж байна... (удаж магадгүй)' : 'Оруулж байна...'}
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">Файл сонгох</p>
                  <p className="text-xs text-gray-400">.csv · .json{aiMode ? ' · .txt' : ''} · чирж оруулж болно</p>
                </>
              )}
              <input
                ref={fileRef} type="file" accept={aiMode ? '.csv,.json,.txt' : '.csv,.json'} className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
              />
            </div>

            {importResult && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                ✅ <strong>{importResult.inserted.toLocaleString()}</strong> үг нэмэгдлээ
                {importResult.skipped > 0 && <span className="text-green-600 ml-1">· {importResult.skipped} давхардал алгасагдсан</span>}
              </div>
            )}

            {aiReport && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
                <p>✅ <strong>{aiReport.inserted}</strong> үг AI-аар бөглөж нэмэгдлээ
                  {aiReport.skipped > 0 && <span className="text-green-600 ml-1">· {aiReport.skipped} давхардал</span>}
                </p>
                {aiReport.failed.length > 0 && (
                  <details className="text-xs text-red-600">
                    <summary className="cursor-pointer">{aiReport.failed.length} үг амжилтгүй (дэлгэрэнгүй)</summary>
                    <ul className="mt-1 list-disc pl-4">
                      {aiReport.failed.slice(0, 20).map((f) => (
                        <li key={f.word}><strong>{f.word}</strong>: {f.message}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
