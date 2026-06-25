import { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, Plus, Pencil, Sparkles, Trash2, Upload, AlertCircle, BarChart2, Volume2, Play } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { ImageCropUpload } from '../../components/ImageCropUpload';
import { FileUpload } from '../../components/FileUpload';
import { FormActions } from '../../components/FormActions';
import { levelFilterOptions as levelOptions, levelFormOptions, CEFR_LEVELS as VALID_LEVELS } from '../../lib/options';

// ── Interfaces ─────────────────────────────────────────────────────────────

interface Word {
  id: string;
  english: string;
  mongolian: string;
  englishDefinition: string | null;
  phonetic: string | null;
  category: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  synonyms: string | null;
  antonyms: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  level: string;
  status: string;
  lessonId: string | null;
}

interface WordStats {
  total: number;
  byStatus: Record<string, number>;
  missingImage: number;
  missingAudio: number;
  missingMnExample: number;
  duplicates: number;
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

interface AiBulkReport {
  requested: number;
  inserted: number;
  skipped: number;
  failed: { word: string; message: string }[];
  // When media (image/audio) is requested the work runs in the background and
  // the server returns immediately — words appear in the list as they finish.
  background?: boolean;
  // Live progress for the background path (polled from the server).
  total?: number;
  processed?: number;
  done?: boolean;
  jobId?: string;
}

interface WordStat {
  wordId: string;
  english: string;
  wrong: number;
  correct: number;
  saved: number;
  learners: number;
  difficulty: number;
}
interface WordAnalytics {
  topForgotten: WordStat[];
  topSaved: WordStat[];
  topKnown: WordStat[];
  hardest: WordStat[];
  avgSaveRate: number;
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

const statusMeta: Record<string, { label: string; color: 'green' | 'blue' | 'yellow' | 'red' | 'gray' }> = {
  draft:        { label: 'Ноорог',       color: 'gray'   },
  needs_review: { label: 'Хянах',        color: 'yellow' },
  approved:     { label: 'Зөвшөөрсөн',  color: 'blue'   },
  rejected:     { label: 'Татгалзсан',  color: 'red'    },
  published:    { label: 'Нийтэлсэн',   color: 'green'  },
};
const statusFormOptions = Object.entries(statusMeta).map(([value, m]) => ({ value, label: m.label }));

const levelColors: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  a1: 'green', a2: 'green', b1: 'blue', b2: 'blue', c1: 'yellow', c2: 'red',
};

interface WordForm {
  english: string; mongolian: string; level: string; status: string;
  englishDefinition: string; phonetic: string; category: string;
  partOfSpeech: string; exampleSentence: string; exampleTranslation: string;
  synonyms: string; antonyms: string;
  imageUrl: string;
  audioUrl: string;
  generateImage: boolean;
  generateAudio: boolean;
}
const empty: WordForm = {
  english: '', mongolian: '', level: 'a1', status: 'published',
  englishDefinition: '', phonetic: '', category: '',
  partOfSpeech: '', exampleSentence: '', exampleTranslation: '',
  synonyms: '', antonyms: '',
  imageUrl: '', audioUrl: '', generateImage: true, generateAudio: true,
};

const CSV_TEMPLATE =
  'english,mongolian,level,category,phonetic,partOfSpeech,englishDefinition,exampleSentence,exampleTranslation,imageUrl,audioUrl\n' +
  'apple,алим,a1,Daily Life,/ˈæpəl/,noun,a round fruit,"A-P-P-L-E гэж бод",I eat an apple every day.,Би өдөр бүр нэг алим иддэг.,,\n' +
  'run,гүйх,a1,Daily Life,/rʌn/,verb,to move fast on foot,,She runs in the park.,Тэр цэцэрлэгт гүйдэг.,,\n';

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Pull English words out of a file for AI bulk import.
 * Accepts: CSV with `english` column, JSON (string[] or {english}[]), or plain list.
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
  // CSV or plain list: take the first column of every non-empty line.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.split(',')[0].replace(/^"|"$/g, '').trim())
    .filter(Boolean);
  // Drop only a LEADING "english" header row — keep a real word "english"
  // that appears elsewhere (the old filter dropped every such line → lost words).
  if (lines[0]?.toLowerCase() === 'english') lines.shift();
  return lines;
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [stats, setStats] = useState<WordStats | null>(null);
  const [analytics, setAnalytics] = useState<WordAnalytics | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [statusTab, setStatusTab] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  // Image lightbox: URL of the image currently being previewed (null = closed).
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  // Reused <audio> element so a new clip stops the previous one.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Anchor row index for shift-click range selection.
  const lastSelectedIndex = useRef<number | null>(null);

  const [modal, setModal] = useState<null | 'create' | 'edit' | 'import'>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState<WordForm>(empty);
  const [saving, setSaving] = useState(false);
  const [aiFilling, setAiFilling] = useState(false);
  const [error, setError] = useState('');

  // Import v2 (multipart CSV with validation report)
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  // AI bulk import (list of English → AI fills everything)
  const [aiMode, setAiMode] = useState(false);
  const [aiImages, setAiImages] = useState(false);
  const [aiAudio, setAiAudio] = useState(false);
  const [aiReport, setAiReport] = useState<AiBulkReport | null>(null);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(() => {
    api.get<WordStats>('/words/stats').then(setStats).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: '200' });
    if (statusTab) params.set('status', statusTab);
    else params.set('all', 'true');
    if (levelFilter) params.set('level', levelFilter);
    if (search.trim()) params.set('search', search.trim());
    const data = await api.get<{ items: Word[] }>(`/words?${params}`);
    setWords(data.items ?? []);
    setSelected(new Set());
  }, [statusTab, levelFilter, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Analytics ─────────────────────────────────────────────────────────────

  function toggleAnalytics() {
    const next = !showAnalytics;
    setShowAnalytics(next);
    if (next && !analytics) api.get<WordAnalytics>('/words/analytics').then(setAnalytics).catch(() => {});
  }

  // ── Select helpers ────────────────────────────────────────────────────────

  /**
   * Select a row checkbox. Holding Shift selects the whole range between the
   * previously-clicked row and this one (like a file manager / Gmail).
   */
  function selectRow(index: number, shiftKey: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      if (shiftKey && lastSelectedIndex.current !== null) {
        const [a, b] = [lastSelectedIndex.current, index].sort((x, y) => x - y);
        for (let i = a; i <= b; i++) n.add(words[i].id);
      } else {
        const id = words[index].id;
        n.has(id) ? n.delete(id) : n.add(id);
      }
      return n;
    });
    lastSelectedIndex.current = index;
  }
  function toggleSelectAll() {
    lastSelectedIndex.current = null;
    setSelected((s) => (s.size === words.length ? new Set() : new Set(words.map((w) => w.id))));
  }

  async function changeStatus(id: string, status: string) {
    try { await api.patch(`/words/${id}`, { status }); load(); loadStats(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
  }

  async function bulkStatus(status: string) {
    if (selected.size === 0) return;
    setBulkBusy(true); setError('');
    try { await api.patch('/words/bulk', { ids: [...selected], changes: { status } }); load(); loadStats(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
    finally { setBulkBusy(false); }
  }

  async function bulkDelete() {
    if (selected.size === 0 || !confirm(`${selected.size} үг устгах уу?`)) return;
    setBulkBusy(true); setError('');
    try { await Promise.all([...selected].map((id) => api.delete(`/words/${id}`))); load(); loadStats(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Алдаа'); }
    finally { setBulkBusy(false); }
  }

  /**
   * Generate image and/or audio for the selected words in the background.
   * Runs server-side (image calls are rate-limited) — the admin can keep
   * working while a progress bar tracks it.
   */
  async function bulkGenerateMedia(image: boolean, audio: boolean) {
    if (selected.size === 0) return;
    const kind = image && audio ? 'зураг + дуудлага' : image ? 'зураг' : 'дуудлага';
    if (!confirm(`${selected.size} үгэнд ${kind} үүсгэх үү? (background-д ажиллана)`)) return;
    setError('');
    try {
      const res = await api.post<{ jobId: string; requested: number; background: boolean }>(
        '/words/bulk-generate-media',
        { wordIds: [...selected], image, audio },
      );
      setSelected(new Set());
      setAiReport({ requested: res.requested, inserted: 0, skipped: 0, failed: [], background: true, total: res.requested, processed: 0, done: false });
      pollBulkJob(res.jobId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Медиа үүсгэхэд алдаа');
    }
  }

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openCreate() { setForm(empty); setEditing(null); setError(''); setModal('create'); }
  function openEdit(w: Word) {
    setForm({
      english: w.english, mongolian: w.mongolian, level: w.level, status: w.status,
      englishDefinition: w.englishDefinition ?? '',
      phonetic: w.phonetic ?? '',
      category: w.category ?? '',
      partOfSpeech: w.partOfSpeech ?? '',
      exampleSentence: w.exampleSentence ?? '',
      exampleTranslation: w.exampleTranslation ?? '',
      synonyms: w.synonyms ?? '',
      antonyms: w.antonyms ?? '',
      imageUrl: w.imageUrl ?? '',
      audioUrl: w.audioUrl ?? '',
      generateImage: false,
      generateAudio: false,
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
        synonyms: string; antonyms: string;
        imageUrl: string | null;
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
        synonyms: result.synonyms || f.synonyms,
        antonyms: result.antonyms || f.antonyms,
        // No preview image here — it's generated once at save (1 image / word).
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
        english: form.english,
        mongolian: form.mongolian,
        englishDefinition: form.englishDefinition || undefined,
        phonetic: form.phonetic || undefined,
        category: form.category || undefined,
        level: form.level,
        status: form.status,
        partOfSpeech: form.partOfSpeech || undefined,
        exampleSentence: form.exampleSentence || undefined,
        exampleTranslation: form.exampleTranslation || undefined,
        synonyms: form.synonyms || undefined,
        antonyms: form.antonyms || undefined,
        imageUrl: form.imageUrl || undefined,
        audioUrl: form.audioUrl || undefined,
        generateImage: form.generateImage || undefined,
        // Only auto-generate audio when no file was uploaded manually.
        generateAudio: (form.generateAudio && !form.audioUrl) || undefined,
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

  async function generateAudio(id: string) {
    setGeneratingId(id);
    try { await api.post(`/words/${id}/generate-audio`, {}); load(); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Аудио үүсгэхэд алдаа гарлаа'); }
    finally { setGeneratingId(null); }
  }

  /** Play a word's pronunciation audio from its CDN URL (stops any prior clip). */
  function playAudio(url: string) {
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => setError('Аудио тоглуулж чадсангүй'));
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImportFile(file: File) {
    setImporting(true); setImportError(''); setImportReport(null); setAiReport(null);

    try {
      if (aiMode) {
        // AI mode: extract English words and let AI fill every field
        const text = await file.text();
        const englishList = extractEnglish(file.name, text);
        if (englishList.length === 0) throw new Error('Англи үг олдсонгүй');
        const body = await api.post<AiBulkReport & { background?: boolean; jobId?: string }>(
          '/words/ai-bulk',
          { words: englishList, generateImages: aiImages, generateAudios: aiAudio },
        );
        if (body.background && body.jobId) {
          // Media bulk runs in the background — poll the job for live progress %.
          const total = body.requested ?? 0;
          setAiReport({ requested: total, inserted: 0, skipped: 0, failed: [], background: true, total, processed: 0, done: false });
          pollBulkJob(body.jobId);
          setModal(null); // close the import modal; progress shows on the main page
        } else {
          setAiReport(body as AiBulkReport);
          load(); loadStats();
        }
      } else {
        // Regular mode: multipart CSV upload with full validation report
        const formData = new FormData();
        formData.append('file', file);
        const body = await api.upload<ImportReport>('/words/import', formData);
        setImportReport(body);
        load(); loadStats();
      }
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : 'Import алдаа');
    } finally { setImporting(false); }
  }

  /** Poll a background AI-bulk job for progress and refresh the list as it runs. */
  function pollBulkJob(jobId: string) {
    const tick = async () => {
      let stop = false;
      try {
        const job = await api.get<Partial<AiBulkReport> & { done?: boolean }>(`/words/ai-bulk/${jobId}`);
        setAiReport((prev) => ({
          ...(prev ?? { requested: 0, inserted: 0, skipped: 0, failed: [] }),
          ...job,
          background: true,
        } as AiBulkReport));
        load();
        if (job.done) { stop = true; loadStats(); }
      } catch {
        stop = true;
      }
      if (!stop) setTimeout(tick, 2500);
    };
    setTimeout(tick, 2000);
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

  // ── Table ──────────────────────────────────────────────────────────────────

  const columns = [
    {
      key: 'select', header: (
        <input type="checkbox" checked={words.length > 0 && selected.size === words.length}
          onChange={toggleSelectAll} className="h-4 w-4 rounded border-gray-300 accent-primary" />
      ),
      render: (w: Word) => (
        <input type="checkbox" checked={selected.has(w.id)} readOnly
          className="h-4 w-4 rounded border-gray-300 accent-primary select-none"
          // Shift+click otherwise highlights text and the click never registers
          // as a clean click — block the text selection so the range works.
          onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
          onClick={(e) => {
            e.stopPropagation();
            window.getSelection()?.removeAllRanges();
            selectRow(words.findIndex((x) => x.id === w.id), e.shiftKey);
          }} />
      ),
      className: 'w-8 select-none',
    },
    {
      key: 'image', header: '', render: (w: Word) => (
        w.imageUrl ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setPreviewImage(w.imageUrl); }}
            className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 cursor-zoom-in transition hover:ring-2 hover:ring-primary/40"
            title="Томоор харах"
          >
            <img src={w.imageUrl} alt="" className="h-full w-full object-cover" />
          </button>
        ) : (
          <div className="h-12 w-12 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-gray-300" />
          </div>
        )
      ),
    },
    {
      key: 'word', header: 'Үг', render: (w: Word) => (
        <div>
          <p className="font-medium">{w.english}</p>
          <p className="text-xs text-gray-400">{w.mongolian}</p>
          {w.phonetic && <p className="text-xs text-gray-300 font-mono">{w.phonetic}</p>}
          {w.exampleSentence && <p className="text-xs text-gray-300 truncate max-w-xs">{w.exampleSentence}</p>}
        </div>
      ),
    },
    {
      key: 'meta', header: 'Түвшин / Ангилал', render: (w: Word) => (
        <div className="flex flex-wrap gap-1">
          <Badge color={levelColors[w.level] ?? 'gray'}>{w.level.toUpperCase()}</Badge>
          {w.partOfSpeech && <span className="text-xs text-gray-400 italic">{w.partOfSpeech}</span>}
          {w.category && <span className="text-xs text-gray-300">{w.category}</span>}
        </div>
      ),
    },
    {
      key: 'status', header: 'Төлөв', render: (w: Word) => (
        <div className="flex items-center gap-2">
          <Badge color={statusMeta[w.status]?.color ?? 'gray'}>{statusMeta[w.status]?.label ?? w.status}</Badge>
          {w.status !== 'published' && (
            <button onClick={() => changeStatus(w.id, 'published')}
              className="text-xs text-primary hover:underline" title="Нийтлэх">
              Нийтлэх
            </button>
          )}
        </div>
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
          {w.audioUrl && (
            <Button variant="ghost" size="sm" onClick={() => playAudio(w.audioUrl!)} title="Дуудлага сонсох">
              <Play className="h-4 w-4 text-primary" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => generateAudio(w.id)} disabled={generatingId === w.id} title="AI дуудлага үүсгэх">
            <Volume2 className={`h-4 w-4 ${w.audioUrl ? 'text-primary' : 'text-gray-400'}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(w)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => remove(w.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
        </div>
      ),
      className: 'text-right',
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Үгийн сан"
        description={stats ? `Нийт: ${stats.total} · Зураггүй: ${stats.missingImage} · Аудиогүй: ${stats.missingAudio}` : 'Үгийн сан'}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={toggleAnalytics}>
              <BarChart2 className="h-4 w-4" /> Аналитик
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setModal('import'); setImportReport(null); setAiReport(null); setImportError(''); }}>
              <Upload className="h-4 w-4" /> Оруулах
            </Button>
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Үг нэмэх</Button>
          </div>
        }
      />

      {/* Learning analytics panel */}
      {showAnalytics && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!analytics ? (
            <p className="text-sm text-gray-400">Ачаалж байна…</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Сурлагын аналитик</h3>
                <span className="text-xs text-gray-500">
                  Дундаж хадгалалт: <strong className="text-primary">{(analytics.avgSaveRate * 100).toFixed(0)}%</strong>
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  { title: '😵 Хамгийн их мартсан', rows: analytics.topForgotten, metric: (r: WordStat) => r.wrong },
                  { title: '⭐ Хамгийн их хадгалсан', rows: analytics.topSaved, metric: (r: WordStat) => r.saved },
                  { title: '✅ Хамгийн их мэдсэн', rows: analytics.topKnown, metric: (r: WordStat) => r.correct },
                  { title: '🔥 Хамгийн хүнд', rows: analytics.hardest, metric: (r: WordStat) => `${(r.difficulty * 100).toFixed(0)}%` },
                ] as const).map((col) => (
                  <div key={col.title}>
                    <p className="mb-1 text-xs font-medium text-gray-500">{col.title}</p>
                    {col.rows.length === 0 ? (
                      <p className="text-xs text-gray-300">Дата алга</p>
                    ) : (
                      <ol className="space-y-1">
                        {col.rows.slice(0, 5).map((r, i) => (
                          <li key={r.wordId} className="flex items-center justify-between text-sm">
                            <span className="truncate"><span className="text-gray-400">{i + 1}.</span> {r.english}</span>
                            <span className="ml-2 font-medium text-gray-600">{col.metric(r)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Stats grid */}
      {stats && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Нийт', value: stats.total, color: 'text-gray-800' },
            { label: 'Нийтэлсэн', value: stats.byStatus?.published ?? 0, color: 'text-green-600' },
            { label: 'Хянах', value: stats.byStatus?.needs_review ?? 0, color: 'text-yellow-600' },
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
        <div className="ml-auto flex items-center gap-2 pb-1">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Хайх…" className="w-40 text-xs" />
          <Select options={levelOptions} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-32 text-xs" />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primarySoft px-4 py-2 text-sm">
          <span className="font-medium text-primary">{selected.size} сонгосон:</span>
          <Button size="sm" onClick={() => bulkStatus('published')} disabled={bulkBusy}>Нийтлэх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkStatus('approved')} disabled={bulkBusy}>Зөвшөөрөх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkStatus('rejected')} disabled={bulkBusy}>Татгалзах</Button>
          <Button variant="ghost" size="sm" onClick={bulkDelete} disabled={bulkBusy}>
            <Trash2 className="h-4 w-4 text-red-500" /> Устгах
          </Button>
          <span className="mx-1 h-4 w-px bg-primary/20" />
          <Button variant="secondary" size="sm" onClick={() => bulkGenerateMedia(true, false)} disabled={bulkBusy} title="Сонгосон үгсэд AI зураг үүсгэх">
            <ImageIcon className="h-4 w-4 text-primary" /> Зураг үүсгэх
          </Button>
          <Button variant="secondary" size="sm" onClick={() => bulkGenerateMedia(false, true)} disabled={bulkBusy} title="Сонгосон үгсэд AI дуудлага үүсгэх">
            <Volume2 className="h-4 w-4 text-primary" /> Дуудлага үүсгэх
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-500 hover:underline">Цуцлах</button>
        </div>
      )}

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      {/* Background media/import job progress — visible while you keep working */}
      {aiReport && aiReport.background && (() => {
        const total = aiReport.total ?? aiReport.requested ?? 0;
        const processed = aiReport.processed ?? 0;
        const pct = total ? Math.round((processed / total) * 100) : 0;
        return (
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-2">
            <div className="flex items-center justify-between">
              <span>{aiReport.done ? '✅ Медиа үүсгэж дууслаа' : '⏳ Медиа үүсгэж байна (background — үргэлжлүүлэн ажиллаж болно)'}</span>
              {aiReport.done && (
                <button onClick={() => setAiReport(null)} className="text-xs text-blue-500 hover:underline">Хаах</button>
              )}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs">
              {processed}/{total} ({pct}%) · амжилттай <strong>{aiReport.inserted}</strong> · алдаа {aiReport.failed.length}
            </p>
            {aiReport.failed.length > 0 && (
              <details className="text-xs text-red-600">
                <summary className="cursor-pointer">{aiReport.failed.length} амжилтгүй</summary>
                <ul className="mt-1 list-disc pl-4">
                  {aiReport.failed.slice(0, 20).map((f) => (
                    <li key={f.word}>{f.word}: {f.message}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        );
      })()}

      <Table columns={columns} rows={words} keyFn={(w) => w.id} empty="Үг байхгүй байна" />

      {/* Image lightbox — click a thumbnail to view it large */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt=""
            className="max-h-[85vh] max-w-[85vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal size="xl" title={modal === 'create' ? 'Үг нэмэх' : 'Үг засах'} onClose={() => setModal(null)}>
          <div className="space-y-5">
            {/* English word + AI fill — full width, the entry point */}
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input label="Англи үг" value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} placeholder="apple" />
                </div>
                <button
                  type="button"
                  onClick={aiFill}
                  disabled={aiFilling || !form.english.trim()}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primarySoft px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {aiFilling ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <Sparkles className="h-4 w-4" />}
                  {aiFilling ? 'Бөглөж байна...' : 'AI бөглөх'}
                </button>
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-400">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Зөвхөн Англи үгээ бичээд <span className="font-medium text-primary">AI бөглөх</span> дарвал доорх бүх талбар автоматаар бөглөгдөнө.
              </p>
            </div>

            {/* Text fields — 2 columns on desktop, 1 on mobile */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Монгол утга" value={form.mongolian} onChange={(e) => setForm({ ...form, mongolian: e.target.value })} placeholder="алим" />
              <Input label="Ангилал" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Daily Life" />
              <Input wrapperClassName="sm:col-span-2" label="Англи тодорхойлолт" value={form.englishDefinition} onChange={(e) => setForm({ ...form, englishDefinition: e.target.value })} placeholder="a round fruit that grows on trees" />
              <Select label="Түвшин" options={levelFormOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Select label="Төлөв" options={statusFormOptions} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} />
              <Input label="Хэлзүй (noun, verb...)" value={form.partOfSpeech} onChange={(e) => setForm({ ...form, partOfSpeech: e.target.value })} placeholder="noun" />
              <Input label="Дуудлага (phonetic)" value={form.phonetic} onChange={(e) => setForm({ ...form, phonetic: e.target.value })} placeholder="/ˈæpəl/" />
              <Input wrapperClassName="sm:col-span-2" label="Жишээ өгүүлбэр (Англи)" value={form.exampleSentence} onChange={(e) => setForm({ ...form, exampleSentence: e.target.value })} placeholder="I eat an apple every day." />
              <Input wrapperClassName="sm:col-span-2" label="Жишээ өгүүлбэрийн орчуулга" value={form.exampleTranslation} onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })} placeholder="Би өдөр бүр нэг алим иддэг." />
              <Input label="Ижил утгатай (synonyms)" value={form.synonyms} onChange={(e) => setForm({ ...form, synonyms: e.target.value })} placeholder="glad, joyful, cheerful" />
              <Input label="Эсрэг утгатай (antonyms)" value={form.antonyms} onChange={(e) => setForm({ ...form, antonyms: e.target.value })} placeholder="sad, unhappy" />
            </div>

            {/* Media — image + audio side by side on desktop */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <ImageCropUpload
                  value={form.imageUrl}
                  onChange={(url) => setForm(f => ({ ...f, imageUrl: url, generateImage: false }))}
                  label="Зураг"
                  aspect={1}
                />
                {!form.imageUrl && (
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.generateImage} onChange={(e) => setForm({ ...form, generateImage: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI-аар үүсгэх
                    </span>
                  </label>
                )}
              </div>

              <div className="space-y-2">
                <FileUpload
                  accept="audio"
                  value={form.audioUrl}
                  onChange={(url) => setForm((f) => ({ ...f, audioUrl: url }))}
                  label="Дуудлагын аудио (заавал биш)"
                />
                {!form.audioUrl && (
                  <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
                    <input type="checkbox" checked={form.generateAudio} onChange={(e) => setForm({ ...form, generateAudio: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      AI-аар дуудлага үүсгэх
                    </span>
                  </label>
                )}
              </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving}
              className="flex justify-end gap-2 border-t pt-4"
              savingLabel={form.generateImage && !form.imageUrl ? 'Хадгалж, зураг үүсгэж байна...' : 'Хадгалж байна...'} />
          </div>
        </Modal>
      )}

      {/* Import modal */}
      {modal === 'import' && (
        <Modal size="lg" title="Үг оруулах" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {/* Mode toggle */}
            <label className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primarySoft px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={aiMode} onChange={(e) => { setAiMode(e.target.checked); setImportReport(null); setAiReport(null); }}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <span className="text-sm text-gray-700">
                <span className="flex items-center gap-1.5 font-medium text-primary">
                  <Sparkles className="h-4 w-4" /> Зөвхөн англи үгс — AI бусдыг бөглөнө
                </span>
                <span className="text-xs text-gray-500">
                  Англи үгсийн жагсаалт оруулахад орчуулга, тодорхойлолт, жишээ, түвшин гэх мэт бүгдийг AI бөглөж бэлэн болгоно.
                </span>
              </span>
            </label>

            {/* Instructions */}
            {aiMode ? (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">Формат: мөр бүрт нэг англи үг (эсвэл CSV/JSON):</p>
                <p className="text-xs text-gray-500 font-mono bg-white rounded px-2 py-1 border border-gray-100 whitespace-pre">abandon{'\n'}ability{'\n'}achieve</p>
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={aiImages} onChange={(e) => setAiImages(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="flex items-center gap-1.5"><ImageIcon className="h-4 w-4 text-primary" /> Зураг бас үүсгэх (удаан)</span>
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={aiAudio} onChange={(e) => setAiAudio(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" />
                  <span className="flex items-center gap-1.5"><Volume2 className="h-4 w-4 text-primary" /> Дуудлага бас үүсгэх (удаан)</span>
                </label>
                <p className="mt-1 text-xs text-gray-400">Нэг удаад {(aiImages || aiAudio) ? '25' : '100'}-аас ихгүй үг.</p>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-700">
                <p className="font-medium mb-1">CSV баганын гарчиг:</p>
                <p className="text-xs text-gray-500 font-mono bg-white rounded px-2 py-1 border border-gray-100 overflow-x-auto whitespace-nowrap">
                  english, mongolian, level, category, phonetic, partOfSpeech, englishDefinition, exampleSentence, exampleTranslation, imageUrl, audioUrl
                </p>
                <p className="mt-1 text-xs text-gray-400">Зөвхөн <strong>english, mongolian</strong> шаардлагатай. Шинэ үгс → <strong>needs_review</strong>.</p>
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
                  {aiMode ? 'AI бөглөж байна... (удаж магадгүй)' : 'Оруулж байна...'}
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

            {/* Import v2 report */}
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
                {importReport.duplicates.length > 0 && <p className="text-xs text-gray-500">🔁 {importReport.duplicates.length} давхардал алгасагдсан</p>}
                {importReport.missingImage.length > 0 && <p className="text-xs text-gray-400">🖼 {importReport.missingImage.length} үгэнд зураг байхгүй</p>}
                {importReport.missingAudio.length > 0 && <p className="text-xs text-gray-400">🔊 {importReport.missingAudio.length} үгэнд аудио байхгүй</p>}
              </div>
            )}

            {/* AI bulk report */}
            {aiReport && !aiReport.background && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 space-y-1">
                <p>✅ <strong>{aiReport.inserted}</strong> үг AI-аар бөглөж нэмэгдлээ
                  {aiReport.skipped > 0 && <span className="text-green-600 ml-1">· {aiReport.skipped} давхардал</span>}
                </p>
                {aiReport.failed.length > 0 && (
                  <details className="text-xs text-red-600">
                    <summary className="cursor-pointer">{aiReport.failed.length} үг амжилтгүй</summary>
                    <ul className="mt-1 list-disc pl-4">
                      {aiReport.failed.slice(0, 20).map((f) => (
                        <li key={f.word}><strong>{f.word}</strong>: {f.message}</li>
                      ))}
                    </ul>
                  </details>
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
