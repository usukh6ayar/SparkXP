import { useMemo, useState } from 'react';
import { FileUp } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { Input } from './Input';
import { Select } from './Select';
import { FormActions } from './FormActions';
import { levelFormOptions } from '../lib/options';
import type { QuestionType } from './QuizQuestionsEditor';
import { FORMAT_HELP, parseQuizImport, sampleImport, validateQuestion } from '../lib/quizImport';

interface Props {
  /** Modal гарчиг, ж: "Дасгал импорт (Сонсгол)". */
  title: string;
  /** Үүсгэх бүх багцад нэмэгдэх тогтмол талбарууд (ж: `{ category: 'listening' }`). */
  defaults?: Record<string, unknown>;
  /** Сэдэв (topic) сонголтууд. Өгөөгүй бол сэдвийн талбар харагдахгүй. */
  topicOptions?: { value: string; label: string }[];
  /** `quizType` болж хадгалагдах төрлүүд (Quiz хуудсанд = тоглоомын төрөл). */
  typeOptions: { value: string; label: string }[];
  /** Сонгосон төрөл → CSV задлах асуултын формат. Анхдагчаар өөрөө нь. */
  questionTypeOf?: (value: string) => QuestionType;
  defaultXp?: number;
  onClose: () => void;
  /** Импорт амжилттай дууссаны дараа (жагсаалтаа дахин ачаална). */
  onDone: () => void;
}

/**
 * Дундын bulk import модал (Дасгал · Quiz · IELTS).
 * Нэг JSON/CSV-ээс **олон багц** үүсгэж чадна — дэлгэрэнгүй `lib/quizImport.ts`.
 */
export function QuizImportModal({
  title, defaults = {}, topicOptions, typeOptions,
  questionTypeOf = (v) => v as QuestionType,
  defaultXp = 50, onClose, onDone,
}: Props) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState(typeOptions[0].value);
  const [text, setText] = useState('');
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');

  const format = questionTypeOf(type);
  const help = FORMAT_HELP[format];

  // Live preview: parse on every keystroke so mistakes surface before posting.
  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try {
      const quizzes = parseQuizImport(text, format);
      for (const [qi, quiz] of quizzes.entries()) {
        if (!quiz.questions?.length) throw new Error(`Багц #${qi + 1}: асуулт алга`);
        for (const [i, q] of quiz.questions.entries()) {
          const bad = validateQuestion(q);
          if (bad) throw new Error(`Багц #${qi + 1}, асуулт #${i + 1}: ${bad}`);
        }
      }
      return { quizzes, error: '' };
    } catch (e) {
      return { quizzes: [], error: e instanceof Error ? e.message : 'Задлахад алдаа гарлаа' };
    }
  }, [text, format]);

  const quizzes = preview?.quizzes ?? [];
  const questionCount = quizzes.reduce((n, q) => n + (q.questions?.length ?? 0), 0);
  /** JSON өөрөө гарчигтай ирвэл дээрх "Гарчиг" талбар хэрэггүй. */
  const titledByFile = quizzes.length > 0 && quizzes.every((q) => q.title?.trim());

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setText(await file.text());
    if (!name.trim()) setName(file.name.replace(/\.[^.]+$/, ''));
    e.target.value = ''; // ижил файлыг дахин сонгож болохоор
  }

  async function run() {
    if (preview?.error) { setError(preview.error); return; }
    if (quizzes.length === 0) { setError('Өгөгдөл оруулна уу'); return; }
    if (!titledByFile && !name.trim()) { setError('Гарчиг оруулна уу'); return; }

    setBusy(true); setError(''); setDone(0);
    const failed: string[] = [];
    for (const [i, quiz] of quizzes.entries()) {
      const quizTitle = quiz.title?.trim() || (quizzes.length > 1 ? `${name.trim()} ${i + 1}` : name.trim());
      try {
        await api.post('/quizzes', {
          ...defaults,
          title: quizTitle,
          level: quiz.level ?? level,
          quizType: quiz.quizType ?? type,
          ...((quiz.topic ?? topic) ? { topic: quiz.topic ?? topic } : {}),
          questions: quiz.questions,
          xpReward: quiz.xpReward ?? defaultXp,
          isPublished: publish,
          ...(quiz.passageText ? { passageText: quiz.passageText } : {}),
          ...(quiz.audioUrl ? { audioUrl: quiz.audioUrl } : {}),
        });
      } catch (e) {
        failed.push(`${quizTitle}: ${e instanceof Error ? e.message : 'алдаа'}`);
      }
      setDone(i + 1);
    }
    setBusy(false);

    if (failed.length === 0) { onDone(); onClose(); return; }
    // Partial success: keep the modal open so the failed rows can be fixed.
    setError(`${quizzes.length - failed.length}/${quizzes.length} амжилттай. Алдаа: ${failed.join(' · ')}`);
    onDone();
  }

  return (
    <Modal title={title} onClose={onClose} size="2xl">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label={quizzes.length > 1 ? 'Гарчиг (ард нь 1, 2, 3… нэмэгдэнэ)' : 'Гарчиг'}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={titledByFile ? 'Файлын гарчиг ашиглагдана' : ''}
            disabled={titledByFile}
          />
          <Select label="Түвшин" options={levelFormOptions} value={level} onChange={(e) => setLevel(e.target.value)} />
          {topicOptions && (
            <Select label="Сэдэв" options={topicOptions} value={topic} onChange={(e) => setTopic(e.target.value)} />
          )}
          {typeOptions.length > 1 && (
            <Select label="Төрөл" options={typeOptions} value={type} onChange={(e) => setType(e.target.value)} />
          )}
        </div>

        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
          <p className="font-medium text-gray-700">Формат — мөр бүр = 1 асуулт, `|`-аар тусгаарлана:</p>
          <p className="mt-1 font-mono text-gray-700">{help.sample}</p>
          <p className="mt-1">{help.fields}</p>
          <p className="mt-2">
            <b>Олон багц</b> нэг дор оруулах бол JSON массив буулгана:{' '}
            <span className="font-mono">[{'{'}"title":"...","questions":[…]{'}'}, …]</span> — багц бүр өөрийн
            гарчиг · түвшин · сэдэвтэй байж болно (өгөөгүйг нь дээрх утгаар нөхнө).
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Өгөгдөл</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setText(sampleImport(format, name.trim() || 'Багц'))}
                className="text-xs font-medium text-primary hover:underline"
              >
                Жишээ буулгах
              </button>
              <label className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline">
                <FileUp className="h-3.5 w-3.5" /> Файл сонгох
                <input type="file" accept=".csv,.txt,.json" className="hidden" onChange={pickFile} />
              </label>
            </div>
          </div>
          <textarea
            className="rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={10}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Энд CSV (|-аар) эсвэл JSON буулгана..."
          />
          {preview && (
            preview.error
              ? <p className="text-xs text-red-500">⚠️ {preview.error}</p>
              : <p className="text-xs text-green-600">
                  ✓ {quizzes.length} багц · нийт {questionCount} асуулт бэлэн
                </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Шууд нийтлэх
        </label>
        {!publish && (
          <p className="text-xs text-amber-600">
            ⚠️ Нийтлээгүй (ноорог) контент апп дээр огт харагдахгүй — шалгаад "Нийтлэх" дарна уу.
          </p>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        <FormActions
          onCancel={onClose}
          onSave={run}
          saving={busy}
          saveLabel={quizzes.length > 1 ? `${quizzes.length} багц импортлох` : 'Импортлох'}
          savingLabel={`Импортлож байна… ${done}/${quizzes.length}`}
        />
      </div>
    </Modal>
  );
}
