import { useState, useEffect, useCallback } from 'react';
import { Plus, Image as ImageIcon, Scissors, X, Eye, EyeOff } from 'lucide-react';
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
import { levelFormOptions as levelOptions } from '../../lib/options';

interface KeyVocab {
  word: string;
  correctMeaning?: string;
  choices?: string[];
  correctIndex?: number;
  reviewed?: boolean;
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
  wordCount: number;
  estimatedReadingTime: number;
  coverImageUrl?: string | null;
  keyVocab: KeyVocab[];
  sentences: Sentence[];
  isPublished: boolean;
}

interface ReadingForm {
  title: string;
  cefr: string;
  coverImageUrl: string;
  keyVocab: string; // comma-separated words (Phase 1)
  rawText: string; // pasted passage, source for the splitter
  sentences: string[]; // editable sentence list
  isPublished: boolean;
}
const emptyForm: ReadingForm = {
  title: '',
  cefr: 'a1',
  coverImageUrl: '',
  keyVocab: '',
  rawText: '',
  sentences: [],
  isPublished: false,
};

/** Client-side sentence splitter — matches the rough server splitter; the admin
 *  edits the result by hand so it doesn't need to be perfect. */
function splitSentences(text: string): string[] {
  if (!text.trim()) return [];
  return (text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g) ?? [])
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format seconds as a short "Xм Yс" reading-time label. */
function fmtTime(sec: number): string {
  if (!sec) return '—';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}м ${s}с` : `${s}с`;
}

export default function ReadingPage() {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Passage | null>(null);
  const [form, setForm] = useState<ReadingForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    // all=true so drafts show in the admin panel (students get published only).
    const data = await api.get<{ items: Passage[] }>('/reading?all=true&limit=200');
    setPassages(data.items ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm);
    setEditing(null);
    setError('');
    setModal('create');
  }
  function openEdit(p: Passage) {
    setForm({
      title: p.title,
      cefr: p.cefr,
      coverImageUrl: p.coverImageUrl ?? '',
      keyVocab: (p.keyVocab ?? []).map((k) => k.word).join(', '),
      rawText: '',
      sentences: (p.sentences ?? []).map((s) => s.text),
      isPublished: p.isPublished,
    });
    setEditing(p);
    setError('');
    setModal('edit');
  }

  function applySplit() {
    const fromRaw = splitSentences(form.rawText);
    if (fromRaw.length === 0) return;
    // Append to any existing sentences, then clear the raw box.
    setForm({ ...form, sentences: [...form.sentences, ...fromRaw], rawText: '' });
  }
  function updateSentence(i: number, text: string) {
    const next = [...form.sentences];
    next[i] = text;
    setForm({ ...form, sentences: next });
  }
  function removeSentence(i: number) {
    setForm({ ...form, sentences: form.sentences.filter((_, idx) => idx !== i) });
  }

  async function save() {
    if (!form.title.trim()) {
      setError('Гарчиг оруулна уу');
      return;
    }
    const sentences = form.sentences
      .map((t) => t.trim())
      .filter(Boolean)
      .map((text, index) => ({ index, text, audioUrl: null }));
    if (sentences.length === 0) {
      setError('Дор хаяж нэг өгүүлбэр оруулна уу');
      return;
    }
    const keyVocab = form.keyVocab
      .split(',')
      .map((w) => w.trim())
      .filter(Boolean)
      .map((word) => ({ word }));

    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        cefr: form.cefr,
        coverImageUrl: form.coverImageUrl || undefined,
        keyVocab,
        sentences,
        isPublished: form.isPublished,
      };
      if (modal === 'create') await api.post('/reading', payload);
      else if (editing) await api.patch(`/reading/${editing.id}`, payload);
      setModal(null);
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
          <img
            src={p.coverImageUrl}
            alt=""
            className="h-10 w-14 rounded object-cover border border-gray-200"
          />
        ) : (
          <div className="flex h-10 w-14 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50">
            <ImageIcon className="h-4 w-4 text-gray-300" />
          </div>
        ),
      className: 'w-16',
    },
    {
      key: 'title',
      header: 'Гарчиг',
      render: (p: Passage) => <span className="font-medium">{p.title}</span>,
    },
    {
      key: 'cefr',
      header: 'CEFR',
      render: (p: Passage) => <Badge color="blue">{p.cefr.toUpperCase()}</Badge>,
    },
    {
      key: 'words',
      header: 'Үг',
      render: (p: Passage) => <span className="text-gray-600">{p.wordCount}</span>,
    },
    {
      key: 'sentences',
      header: 'Өгүүлбэр',
      render: (p: Passage) => (
        <span className="text-gray-600">{p.sentences?.length ?? 0}</span>
      ),
    },
    {
      key: 'time',
      header: 'Хугацаа',
      render: (p: Passage) => (
        <span className="text-gray-500">{fmtTime(p.estimatedReadingTime)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Төлөв',
      render: (p: Passage) => (
        <button onClick={() => togglePublish(p)} title="Дарж нийтлэх төлөв солих">
          {p.isPublished ? (
            <Badge color="green">Нийтэлсэн</Badge>
          ) : (
            <Badge color="gray">Ноорог</Badge>
          )}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Passage) => (
        <div className="flex gap-1 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => togglePublish(p)}
            title={p.isPublished ? 'Нийтлэхээ болих' : 'Нийтлэх'}
          >
            {p.isPublished ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-green-600" />
            )}
          </Button>
          <RowActions onEdit={() => openEdit(p)} onDelete={() => remove(p.id)} />
        </div>
      ),
      className: 'text-right',
    },
  ];

  const publishedCount = passages.filter((p) => p.isPublished).length;

  return (
    <>
      <PageHeader
        title="Унших материал"
        description={`Нийт: ${passages.length} · Нийтэлсэн: ${publishedCount}`}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Материал нэмэх
          </Button>
        }
      />
      <Table
        columns={columns}
        rows={passages}
        keyFn={(p) => p.id}
        empty="Унших материал байхгүй"
      />

      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Унших материал нэмэх' : 'Унших материал засах'}
          onClose={() => setModal(null)}
          size="xl"
        >
          <div className="space-y-4">
            <Input
              label="Гарчиг"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="CEFR түвшин"
                options={levelOptions}
                value={form.cefr}
                onChange={(e) => setForm({ ...form, cefr: e.target.value })}
              />
              <ImageCropUpload
                label="Cover зураг (заавал биш)"
                value={form.coverImageUrl}
                onChange={(url) => setForm({ ...form, coverImageUrl: url })}
              />
            </div>

            <Input
              label="Гол үгс (таслалаар тусгаарла)"
              placeholder="abandon, brave, curious"
              value={form.keyVocab}
              onChange={(e) => setForm({ ...form, keyVocab: e.target.value })}
            />

            {/* Paste passage → split into editable sentences */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Текст оруулаад өгүүлбэрт хуваах
              </label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                rows={4}
                placeholder="Бүтэн текстээ энд буулгаад доорх товчийг дар..."
                value={form.rawText}
                onChange={(e) => setForm({ ...form, rawText: e.target.value })}
              />
              <div>
                <Button variant="secondary" size="sm" onClick={applySplit}>
                  <Scissors className="h-4 w-4" /> Өгүүлбэрт хуваах
                </Button>
              </div>
            </div>

            {/* Editable sentence list */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">
                Өгүүлбэрүүд ({form.sentences.length})
              </label>
              {form.sentences.length === 0 && (
                <p className="text-xs text-gray-400">
                  Текстээ дээр хуваах эсвэл доороос гараар нэмнэ үү.
                </p>
              )}
              {form.sentences.map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-xs text-gray-400">
                    {i + 1}.
                  </span>
                  <Input
                    wrapperClassName="flex-1"
                    value={s}
                    onChange={(e) => updateSentence(i, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSentence(i)}
                    title="Устгах"
                  >
                    <X className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setForm({ ...form, sentences: [...form.sentences, ''] })}
                >
                  <Plus className="h-4 w-4" /> Өгүүлбэр нэмэх
                </Button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
              />
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
