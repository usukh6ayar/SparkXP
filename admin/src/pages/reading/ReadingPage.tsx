import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Image as ImageIcon,
  Scissors,
  X,
  Eye,
  EyeOff,
  Sparkles,
  Volume2,
  RefreshCw,
} from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { ImageCropUpload } from '../../components/ImageCropUpload';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';
import { Pagination } from '../../components/Pagination';
import { levelFormOptions as levelOptions, readingCategoryOptions } from '../../lib/options';

const LIMIT = 20;

interface KeyVocab {
  word: string;
  correctMeaning?: string;
  choices?: string[];
  correctIndex?: number;
  reviewed?: boolean;
}
interface ReadingQuestion {
  type: 'multiple_choice' | 'fill_blank';
  question: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
}
interface Sentence {
  index: number;
  text: string;
  audioUrl: string | null;
}
interface Passage {
  id: string;
  title: string;
  cefr: string;
  category: string | null;
  wordCount: number;
  estimatedReadingTime: number;
  coverImageUrl?: string | null;
  keyVocab: KeyVocab[];
  comprehensionQuestions?: ReadingQuestion[];
  sentences: Sentence[];
  isPublished: boolean;
}

interface SentenceForm {
  text: string;
  audioUrl: string | null;
}
interface ReadingForm {
  title: string;
  cefr: string;
  category: string;
  coverImageUrl: string;
  keyVocab: KeyVocab[];
  comprehensionQuestions: ReadingQuestion[];
  rawText: string;
  sentences: SentenceForm[];
  isPublished: boolean;
}
const emptyForm: ReadingForm = {
  title: '',
  cefr: 'a1',
  category: '',
  coverImageUrl: '',
  keyVocab: [],
  comprehensionQuestions: [],
  rawText: '',
  sentences: [],
  isPublished: false,
};

interface AudioJob {
  total: number;
  processed: number;
  failed?: number;
  done: boolean;
}

/** Client-side sentence splitter — matches the rough server splitter. */
function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}

function fmtTime(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

export default function ReadingPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Passage | null>(null);
  const [form, setForm] = useState<ReadingForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // F1 — AI guess-choices
  const [newWord, setNewWord] = useState('');
  const [genChoices, setGenChoices] = useState(false);
  // AI: generate key words + comprehension questions from the passage text
  const [genAll, setGenAll] = useState(false);

  // F4 — sentence audio
  const [audioJob, setAudioJob] = useState<AudioJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{ items: Passage[]; total: number }>(`/reading?all=true&page=${page}&limit=${LIMIT}`);
    setPassages(data.items ?? []);
    setTotal(data.total ?? 0);
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  // Stop polling when the modal closes / component unmounts.
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setError('');
    setAudioJob(null);
    setModal('create');
  }
  function openEdit(p: Passage) {
    setForm({
      title: p.title,
      cefr: p.cefr,
      category: p.category ?? '',
      coverImageUrl: p.coverImageUrl ?? '',
      keyVocab: p.keyVocab ?? [],
      comprehensionQuestions: p.comprehensionQuestions ?? [],
      rawText: '',
      sentences: (p.sentences ?? []).map((s) => ({ text: s.text, audioUrl: s.audioUrl })),
      isPublished: p.isPublished,
    });
    setEditing(p);
    setError('');
    setAudioJob(null);
    setModal('edit');
  }

  function closeModal() {
    if (pollRef.current) clearInterval(pollRef.current);
    setModal(null);
  }

  function applySplit() {
    const fromRaw = splitSentences(form.rawText);
    if (fromRaw.length === 0) return;
    const added = fromRaw.map((text) => ({ text, audioUrl: null }));
    setForm({ ...form, sentences: [...form.sentences, ...added], rawText: '' });
  }
  function updateSentence(i: number, text: string) {
    const next = [...form.sentences];
    next[i] = { ...next[i], text };
    setForm({ ...form, sentences: next });
  }
  function removeSentence(i: number) {
    setForm({ ...form, sentences: form.sentences.filter((_, idx) => idx !== i) });
  }

  // ── Key vocab (F1) ──────────────────────────────────────────────────────
  function addWord() {
    const w = newWord.trim();
    if (!w) return;
    if (form.keyVocab.some((k) => k.word.toLowerCase() === w.toLowerCase())) {
      setNewWord('');
      return;
    }
    setForm({ ...form, keyVocab: [...form.keyVocab, { word: w, reviewed: false }] });
    setNewWord('');
  }
  function updateVocab(i: number, patch: Partial<KeyVocab>) {
    const next = [...form.keyVocab];
    next[i] = { ...next[i], ...patch };
    setForm({ ...form, keyVocab: next });
  }
  function removeVocab(i: number) {
    setForm({ ...form, keyVocab: form.keyVocab.filter((_, idx) => idx !== i) });
  }

  async function generateGuessChoices() {
    const words = form.keyVocab.map((k) => k.word).filter(Boolean);
    if (words.length === 0) {
      setError('Эхлээд гол үг нэмнэ үү');
      return;
    }
    setGenChoices(true);
    setError('');
    try {
      const res = await api.post<KeyVocab[]>('/reading/guess-choices', {
        words,
        cefr: form.cefr,
      });
      // Merge AI results into matching words.
      const byWord = new Map(res.map((r) => [r.word.toLowerCase(), r]));
      setForm((f) => ({
        ...f,
        keyVocab: f.keyVocab.map((k) => {
          const r = byWord.get(k.word.toLowerCase());
          return r
            ? {
                ...k,
                correctMeaning: r.correctMeaning,
                choices: r.choices,
                correctIndex: r.correctIndex,
                reviewed: false,
              }
            : k;
        }),
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI сонголт гаргахад алдаа');
    } finally {
      setGenChoices(false);
    }
  }

  // ── AI: key words + comprehension questions from the passage ─────────────
  async function generateAll() {
    // Use the already-split sentences, else the raw pasted text.
    const text = form.sentences.map((s) => s.text).join(' ').trim() || form.rawText.trim();
    if (!text) {
      setError('Эхлээд текст (өгүүлбэрүүд) оруулна уу');
      return;
    }
    setGenAll(true);
    setError('');
    try {
      const res = await api.post<{ keyVocab: KeyVocab[]; questions: ReadingQuestion[] }>(
        '/reading/generate',
        { text, cefr: form.cefr },
      );
      setForm((f) => ({
        ...f,
        keyVocab: (res.keyVocab ?? []).map((k) => ({ ...k, reviewed: false })),
        comprehensionQuestions: res.questions ?? [],
      }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'AI үүсгэхэд алдаа');
    } finally {
      setGenAll(false);
    }
  }

  // ── Comprehension questions editor ───────────────────────────────────────
  function addQuestion(type: ReadingQuestion['type']) {
    const q: ReadingQuestion =
      type === 'multiple_choice'
        ? { type, question: '', options: ['', '', '', ''], correctIndex: 0 }
        : { type, question: '', answer: '' };
    setForm((f) => ({ ...f, comprehensionQuestions: [...f.comprehensionQuestions, q] }));
  }
  function updateQuestion(i: number, patch: Partial<ReadingQuestion>) {
    setForm((f) => {
      const next = [...f.comprehensionQuestions];
      next[i] = { ...next[i], ...patch };
      return { ...f, comprehensionQuestions: next };
    });
  }
  function removeQuestion(i: number) {
    setForm((f) => ({
      ...f,
      comprehensionQuestions: f.comprehensionQuestions.filter((_, idx) => idx !== i),
    }));
  }
  function updateQOption(i: number, oi: number, val: string) {
    setForm((f) => {
      const next = [...f.comprehensionQuestions];
      const opts = [...(next[i].options ?? [])];
      opts[oi] = val;
      next[i] = { ...next[i], options: opts };
      return { ...f, comprehensionQuestions: next };
    });
  }

  // ── Sentence audio (F4) ─────────────────────────────────────────────────
  async function reloadEditingSentences() {
    if (!editing) return;
    const p = await api.get<Passage>(`/reading/${editing.id}`);
    setForm((f) => ({
      ...f,
      sentences: p.sentences.map((s) => ({ text: s.text, audioUrl: s.audioUrl })),
    }));
  }

  async function generateAllAudio() {
    if (!editing) return;
    setError('');
    try {
      const { jobId } = await api.post<{ jobId: string }>(
        `/reading/${editing.id}/generate-audio`,
        {},
      );
      setAudioJob({ total: form.sentences.length, processed: 0, done: false });
      pollRef.current = setInterval(async () => {
        try {
          const job = await api.get<AudioJob & { expired?: boolean }>(
            `/reading/audio-job/${jobId}`,
          );
          setAudioJob(job);
          if (job.done || job.expired) {
            if (pollRef.current) clearInterval(pollRef.current);
            await reloadEditingSentences();
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 1500);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Аудио үүсгэхэд алдаа');
    }
  }

  async function regenSentenceAudio(i: number) {
    if (!editing) return;
    try {
      const { audioUrl } = await api.post<{ index: number; audioUrl: string }>(
        `/reading/${editing.id}/sentences/${i}/generate-audio`,
        {},
      );
      const next = [...form.sentences];
      next[i] = { ...next[i], audioUrl };
      setForm({ ...form, sentences: next });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Аудио үүсгэхэд алдаа');
    }
  }

  async function save() {
    if (!form.title.trim()) {
      setError('Гарчиг оруулна уу');
      return;
    }
    const sentences = form.sentences
      .map((s) => ({ text: s.text.trim(), audioUrl: s.audioUrl }))
      .filter((s) => s.text)
      .map((s, index) => ({ index, ...s }));
    if (sentences.length === 0) {
      setError('Дор хаяж нэг өгүүлбэр оруулна уу');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        cefr: form.cefr,
        category: form.category || null,
        coverImageUrl: form.coverImageUrl || undefined,
        keyVocab: form.keyVocab,
        comprehensionQuestions: form.comprehensionQuestions,
        sentences,
        isPublished: form.isPublished,
      };
      if (modal === 'create') await api.post('/reading', payload);
      else if (editing) await api.patch(`/reading/${editing.id}`, payload);
      closeModal();
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(p: Passage) {
    await api.patch(`/reading/${p.id}`, { isPublished: !p.isPublished });
    load();
  }

  async function remove(id: string) {
    if (!confirm('Унших материал устгах уу?')) return;
    await api.delete(`/reading/${id}`);
    load();
  }

  const columns = [
    {
      key: 'cover',
      header: '',
      render: (p: Passage) =>
        p.coverImageUrl ? (
          <img src={p.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover border border-gray-200" />
        ) : (
          <div className="flex h-10 w-14 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50">
            <ImageIcon className="h-4 w-4 text-gray-300" />
          </div>
        ),
      className: 'w-16',
    },
    { key: 'title', header: 'Гарчиг', render: (p: Passage) => <span className="font-medium">{p.title}</span> },
    { key: 'cefr', header: 'CEFR', render: (p: Passage) => <Badge color="blue">{p.cefr.toUpperCase()}</Badge> },
    {
      key: 'category',
      header: 'Сэдэв',
      render: (p: Passage) =>
        p.category ? <Badge color="yellow">{p.category}</Badge> : <span className="text-gray-300">—</span>,
    },
    { key: 'words', header: 'Үг', render: (p: Passage) => <span className="text-gray-600">{p.wordCount}</span> },
    {
      key: 'sentences',
      header: 'Өгүүлбэр',
      render: (p: Passage) => <span className="text-gray-600">{p.sentences?.length ?? 0}</span>,
    },
    { key: 'time', header: 'Хугацаа', render: (p: Passage) => <span className="text-gray-500">{fmtTime(p.estimatedReadingTime)}</span> },
    {
      key: 'status',
      header: 'Төлөв',
      render: (p: Passage) => (
        <button onClick={() => togglePublish(p)} title="Дарж нийтлэх төлөв солих">
          {p.isPublished ? <Badge color="green">Нийтэлсэн</Badge> : <Badge color="gray">Ноорог</Badge>}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Passage) => (
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="sm" onClick={() => togglePublish(p)} title={p.isPublished ? 'Нийтлэхээ болих' : 'Нийтлэх'}>
            {p.isPublished ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-green-600" />}
          </Button>
          <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p.id)} />
        </div>
      ),
      className: 'text-right',
    },
  ];

  const publishedCount = passages.filter((p) => p.isPublished).length;
  const audioPct = audioJob && audioJob.total ? Math.round((audioJob.processed / audioJob.total) * 100) : 0;

  return (
    <>
      {embedded ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Нийт: {passages.length} · Нийтэлсэн: {publishedCount}</p>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Материал нэмэх</Button>
        </div>
      ) : (
        <PageHeader
          title="Унших материал"
          description={`Нийт: ${passages.length} · Нийтэлсэн: ${publishedCount}`}
          action={<Button onClick={openCreate}><Plus className="h-4 w-4" /> Материал нэмэх</Button>}
        />
      )}
      <Table columns={columns} rows={passages} keyFn={(p) => p.id} empty="Унших материал байхгүй" />
      <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Унших материал нэмэх' : 'Унших материал засах'} onClose={closeModal} size="2xl">
          <div className="space-y-5">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="CEFR түвшин" options={levelOptions} value={form.cefr} onChange={(e) => setForm({ ...form, cefr: e.target.value })} />
              <Select label="Сэдэв (category)" options={readingCategoryOptions} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </div>
            <ImageCropUpload label="Cover зураг (заавал биш)" value={form.coverImageUrl} onChange={(url) => setForm({ ...form, coverImageUrl: url })} />

            {/* ── F1: Key vocab + AI guess choices ── */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Гол үгс — таах сонголт (F1)</h3>
                <Button variant="secondary" size="sm" onClick={generateGuessChoices} disabled={genChoices || form.keyVocab.length === 0}>
                  <Sparkles className="h-4 w-4" /> {genChoices ? 'Гаргаж байна...' : 'AI-аар сонголт гаргах'}
                </Button>
              </div>
              <div className="mb-3 flex gap-2">
                <Input
                  wrapperClassName="flex-1"
                  placeholder="Үг нэмэх (ж: brave)"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWord(); } }}
                />
                <Button variant="secondary" onClick={addWord}><Plus className="h-4 w-4" /></Button>
              </div>
              {form.keyVocab.length === 0 && <p className="text-xs text-gray-400">Гол үг нэмээд "AI-аар сонголт гаргах" дарна уу.</p>}
              <div className="space-y-3">
                {form.keyVocab.map((v, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="font-semibold text-gray-800">{v.word}</span>
                      <div className="flex items-center gap-3">
                        {v.choices && v.choices.length > 0 && (
                          <label className="flex items-center gap-1 text-xs text-gray-600">
                            <input type="checkbox" checked={!!v.reviewed} onChange={(e) => updateVocab(i, { reviewed: e.target.checked })} />
                            Шалгасан
                          </label>
                        )}
                        <button onClick={() => removeVocab(i)} title="Устгах"><X className="h-4 w-4 text-red-500" /></button>
                      </div>
                    </div>
                    {v.choices && v.choices.length > 0 ? (
                      <div className="space-y-2">
                        {v.choices.map((c, ci) => (
                          <div key={ci} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${i}`}
                              checked={v.correctIndex === ci}
                              onChange={() => updateVocab(i, { correctIndex: ci, correctMeaning: c })}
                              title="Зөв хариу"
                            />
                            <Input
                              wrapperClassName="flex-1"
                              value={c}
                              onChange={(e) => {
                                const choices = [...(v.choices ?? [])];
                                choices[ci] = e.target.value;
                                const patch: Partial<KeyVocab> = { choices };
                                if (v.correctIndex === ci) patch.correctMeaning = e.target.value;
                                updateVocab(i, patch);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Сонголт хараахан гараагүй.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Passage text → sentences */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Текст оруулаад өгүүлбэрт хуваах</label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={4}
                placeholder="Бүтэн текстээ энд буулгаад доорх товчийг дар..."
                value={form.rawText}
                onChange={(e) => setForm({ ...form, rawText: e.target.value })}
              />
              <div>
                <Button variant="secondary" size="sm" onClick={applySplit}><Scissors className="h-4 w-4" /> Өгүүлбэрт хуваах</Button>
              </div>
            </div>

            {/* ── F4: Sentences + audio ── */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">Өгүүлбэрүүд ({form.sentences.length})</label>
                {modal === 'edit' && form.sentences.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={generateAllAudio} disabled={!!audioJob && !audioJob.done}>
                    <Volume2 className="h-4 w-4" /> Бүх дуу үүсгэх
                  </Button>
                )}
              </div>
              {audioJob && (
                <div className="mb-1">
                  <div className="h-2 w-full rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${audioPct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {audioJob.done ? '✓ Дууссан' : `Аудио үүсгэж байна… ${audioJob.processed}/${audioJob.total}`}
                  </p>
                </div>
              )}
              {form.sentences.length === 0 && <p className="text-xs text-gray-400">Текстээ дээр хуваах эсвэл доороос гараар нэмнэ үү.</p>}
              {form.sentences.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-xs text-gray-400">{i + 1}.</span>
                  <Input wrapperClassName="flex-1" value={s.text} onChange={(e) => updateSentence(i, e.target.value)} />
                  {modal === 'edit' && (
                    <>
                      {s.audioUrl && (
                        <button onClick={() => { new Audio(s.audioUrl!).play(); }} title="Сонсох" className="mt-1.5">
                          <Volume2 className="h-4 w-4 text-primary" />
                        </button>
                      )}
                      <button onClick={() => regenSentenceAudio(i)} title="Дуу (дахин) үүсгэх" className="mt-1.5">
                        <RefreshCw className="h-4 w-4 text-gray-400" />
                      </button>
                    </>
                  )}
                  <button onClick={() => removeSentence(i)} title="Устгах" className="mt-1.5"><X className="h-4 w-4 text-red-500" /></button>
                </div>
              ))}
              <div>
                <Button variant="secondary" size="sm" onClick={() => setForm({ ...form, sentences: [...form.sentences, { text: '', audioUrl: null }] })}>
                  <Plus className="h-4 w-4" /> Өгүүлбэр нэмэх
                </Button>
              </div>
            </div>

            {/* ── Comprehension questions (asked after finishing) ── */}
            <div className="rounded-lg border border-gray-200 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-800">Асуултууд — унших дуусахад ({form.comprehensionQuestions.length})</h3>
                <Button variant="secondary" size="sm" onClick={generateAll} disabled={genAll}>
                  <Sparkles className="h-4 w-4" /> {genAll ? 'Үүсгэж байна...' : 'AI-аар гол үг + асуулт үүсгэх'}
                </Button>
              </div>

              {form.comprehensionQuestions.length === 0 && (
                <p className="mb-2 text-xs text-gray-400">Текстээс "AI-аар..." дарж үүсгэх эсвэл гараар нэмнэ үү.</p>
              )}

              <div className="space-y-3">
                {form.comprehensionQuestions.map((q, i) => (
                  <div key={i} className="rounded-lg bg-gray-50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-500">
                        {q.type === 'multiple_choice' ? 'Олон сонголт' : 'Нөхөх'} #{i + 1}
                      </span>
                      <button onClick={() => removeQuestion(i)} title="Устгах"><X className="h-4 w-4 text-red-500" /></button>
                    </div>
                    <Input
                      wrapperClassName="mb-2"
                      placeholder="Асуулт"
                      value={q.question}
                      onChange={(e) => updateQuestion(i, { question: e.target.value })}
                    />
                    {q.type === 'multiple_choice' ? (
                      <div className="space-y-2">
                        {(q.options ?? []).map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`q-correct-${i}`}
                              checked={q.correctIndex === oi}
                              onChange={() => updateQuestion(i, { correctIndex: oi })}
                              title="Зөв хариу"
                            />
                            <Input
                              wrapperClassName="flex-1"
                              placeholder={`Сонголт ${oi + 1}`}
                              value={opt}
                              onChange={(e) => updateQOption(i, oi, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Input
                        placeholder="Зөв хариулт"
                        value={q.answer ?? ''}
                        onChange={(e) => updateQuestion(i, { answer: e.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => addQuestion('multiple_choice')}>
                  <Plus className="h-4 w-4" /> Олон сонголт
                </Button>
                <Button variant="secondary" size="sm" onClick={() => addQuestion('fill_blank')}>
                  <Plus className="h-4 w-4" /> Нөхөх
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
              Шууд нийтлэх
            </label>

            {modal === 'create' && (
              <p className="text-xs text-gray-400">💡 Аудио үүсгэхийн тулд эхлээд хадгална уу (засах горимд боломжтой).</p>
            )}
            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={closeModal} onSave={save} saving={saving} />
          </div>
        </Modal>
      )}
    </>
  );
}
