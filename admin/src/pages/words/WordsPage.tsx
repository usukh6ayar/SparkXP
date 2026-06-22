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

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

interface Word {
  id: string;
  english: string;
  mongolian: string;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  imageUrl: string | null;
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

interface WordForm {
  english: string; mongolian: string; level: string;
  partOfSpeech: string; exampleSentence: string; exampleTranslation: string;
  generateImage: boolean;
}
const empty: WordForm = {
  english: '', mongolian: '', level: 'a1',
  partOfSpeech: '', exampleSentence: '', exampleTranslation: '',
  generateImage: true,
};

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

export default function WordsPage() {
  const [words, setWords] = useState<Word[]>([]);
  const [levelFilter, setLevelFilter] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'edit' | 'import'>(null);
  const [editing, setEditing] = useState<Word | null>(null);
  const [form, setForm] = useState<WordForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const qs = levelFilter ? `?level=${levelFilter}&limit=200` : '?limit=200';
    const data = await api.get<{ items: Word[]; total: number }>(`/words${qs}`);
    setWords(data.items ?? []);
  }, [levelFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(empty); setEditing(null); setError(''); setModal('create'); }
  function openEdit(w: Word) {
    setForm({
      english: w.english, mongolian: w.mongolian, level: w.level,
      partOfSpeech: w.partOfSpeech ?? '',
      exampleSentence: w.exampleSentence ?? '',
      exampleTranslation: w.exampleTranslation ?? '',
      generateImage: false,
    });
    setEditing(w); setError(''); setModal('edit');
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
        level: form.level,
        partOfSpeech: form.partOfSpeech || undefined,
        exampleSentence: form.exampleSentence || undefined,
        exampleTranslation: form.exampleTranslation || undefined,
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
    setImporting(true); setError(''); setImportResult(null);
    try {
      const text = await file.text();
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

      <div className="mb-4">
        <Select options={levelOptions} value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)} className="w-40" />
      </div>

      <Table columns={columns} rows={words} keyFn={(w) => w.id} empty="Үг байхгүй байна" />

      {/* Create / Edit modal */}
      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Үг нэмэх' : 'Үг засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Англи үг" value={form.english} onChange={(e) => setForm({ ...form, english: e.target.value })} placeholder="apple" />
              <Input label="Монгол утга" value={form.mongolian} onChange={(e) => setForm({ ...form, mongolian: e.target.value })} placeholder="алим" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Түвшин" options={levelFormOptions} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Input label="Хэлзүй (noun, verb...)" value={form.partOfSpeech} onChange={(e) => setForm({ ...form, partOfSpeech: e.target.value })} placeholder="noun" />
            </div>
            <Input label="Жишээ өгүүлбэр (Англи)" value={form.exampleSentence} onChange={(e) => setForm({ ...form, exampleSentence: e.target.value })} placeholder="I eat an apple every day." />
            <Input label="Жишээ өгүүлбэрийн орчуулга" value={form.exampleTranslation} onChange={(e) => setForm({ ...form, exampleTranslation: e.target.value })} placeholder="Би өдөр бүр нэг алим иддэг." />
            {editing?.imageUrl && (
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <img src={editing.imageUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Одоогийн зураг</p>
                  <p className="text-xs text-gray-500 break-all">{editing.imageUrl}</p>
                </div>
              </div>
            )}
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.generateImage}
                onChange={(e) => setForm({ ...form, generateImage: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                {modal === 'create' ? 'Зураг автоматаар үүсгэх' : 'Зургийг шинээр үүсгэх'}
              </span>
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModal(null)}>Болих</Button>
              <Button onClick={save} disabled={saving}>
                {saving
                  ? (form.generateImage ? 'Хадгалж, зураг үүсгэж байна...' : 'Хадгалж байна...')
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
            {/* Instructions */}
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
                  Оруулж байна...
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">Файл сонгох</p>
                  <p className="text-xs text-gray-400">.csv эсвэл .json · чирж оруулж болно</p>
                </>
              )}
              <input
                ref={fileRef} type="file" accept=".csv,.json" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
              />
            </div>

            {importResult && (
              <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                ✅ <strong>{importResult.inserted.toLocaleString()}</strong> үг нэмэгдлээ
                {importResult.skipped > 0 && <span className="text-green-600 ml-1">· {importResult.skipped} давхардал алгасагдсан</span>}
              </div>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
