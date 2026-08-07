import { useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { Select } from './Select';
import { FormActions } from './FormActions';
import { levelFormOptions } from '../lib/options';
import type { QuestionType } from './QuizQuestionsEditor';
import {
  CSV_COLUMNS, TYPE_HINTS, csvTemplate, parseQuizCsv,
  type CsvParseResult,
} from '../lib/quizImport';

interface Props {
  /** Modal гарчиг, ж: "Дасгал оруулах (Сонсгол)". */
  title: string;
  /** Үүсгэх бүх багцад нэмэгдэх тогтмол талбарууд (ж: `{ category: 'listening' }`). */
  defaults?: Record<string, unknown>;
  /** Сэдэв (topic) сонголтууд. Өгөөгүй бол сэдвийн талбар харагдахгүй. */
  topicOptions?: { value: string; label: string }[];
  /** `quizType` болж хадгалагдах төрлүүд (Quiz хуудсанд = тоглоомын төрөл). */
  typeOptions: { value: string; label: string }[];
  /** Сонгосон төрөл → CSV-гийн асуултын формат. Анхдагчаар өөрөө нь. */
  questionTypeOf?: (value: string) => QuestionType;
  defaultXp?: number;
  onClose: () => void;
  /** Импорт дууссаны дараа (жагсаалтаа дахин ачаална). */
  onDone: () => void;
}

/**
 * Дундын Excel/CSV импорт модал (Дасгал · Quiz · IELTS).
 * Үгсийн сангийн импорттой ижил урсгал: загвар татах → файл чирэх → тайлан.
 */
export function QuizImportModal({
  title, defaults = {}, topicOptions, typeOptions,
  questionTypeOf = (v) => v as QuestionType,
  defaultXp = 50, onClose, onDone,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [level, setLevel] = useState('a1');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState(typeOptions[0].value);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState('');
  /** Багц бүрийн үр дүн — импорт дууссаны дараа харуулна. */
  const [failed, setFailed] = useState<string[]>([]);

  const format = questionTypeOf(type);

  async function readFile(file: File) {
    setError(''); setFailed([]); setDone(0);
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Зөвхөн .csv файл — Excel дээр "Save as → CSV UTF-8" гэж хадгална уу.');
      return;
    }
    setFileName(file.name);
    setParsed(parseQuizCsv(await file.text(), format));
  }

  function downloadTemplate() {
    const blob = new Blob([csvTemplate(format)], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `import_template_${format}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /** Төрөл солиход өмнөх задлалт хүчингүй (багана өөр). */
  function changeType(v: string) {
    setType(v); setParsed(null); setFileName(''); setError(''); setFailed([]);
  }

  async function run() {
    const quizzes = parsed?.quizzes ?? [];
    if (quizzes.length === 0) { setError('Импортлох багц алга'); return; }

    setBusy(true); setError(''); setDone(0);
    const bad: string[] = [];
    for (const [i, quiz] of quizzes.entries()) {
      try {
        await api.post('/quizzes', {
          ...defaults,
          title: quiz.title,
          level: quiz.level ?? level,
          quizType: quiz.quizType ?? type,
          ...((quiz.topic ?? topic) ? { topic: quiz.topic ?? topic } : {}),
          questions: quiz.questions,
          xpReward: defaultXp,
          isPublished: publish,
        });
      } catch (e) {
        bad.push(`${quiz.title}: ${e instanceof Error ? e.message : 'алдаа'}`);
      }
      setDone(i + 1);
    }
    setBusy(false);
    onDone();
    if (bad.length === 0) { onClose(); return; }
    setFailed(bad); // хагас амжилттай — цонхыг нээлттэй үлдээж алдааг харуулна
  }

  const quizzes = parsed?.quizzes ?? [];
  const questionCount = quizzes.reduce((n, q) => n + q.questions.length, 0);
  const rowErrors = parsed?.errors ?? [];

  return (
    <Modal title={title} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {typeOptions.length > 1 && (
            <Select label="Төрөл" options={typeOptions} value={type} onChange={(e) => changeType(e.target.value)} />
          )}
          <Select label="Түвшин (хоосон нүдэнд)" options={levelFormOptions} value={level} onChange={(e) => setLevel(e.target.value)} />
          {topicOptions && (
            <Select label="Сэдэв (хоосон нүдэнд)" options={topicOptions} value={topic} onChange={(e) => setTopic(e.target.value)} />
          )}
        </div>

        {/* Instructions — Үгсийн сангийн импорттой ижил хэв маяг */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
          <p className="mb-1 font-medium">CSV баганын гарчиг:</p>
          <p className="overflow-x-auto whitespace-nowrap rounded border border-gray-100 bg-white px-2 py-1 font-mono text-xs text-gray-500">
            {CSV_COLUMNS.join(', ')}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Мөр бүр = <strong>1 асуулт</strong>. <strong>title</strong> ижил (эсвэл хоосон)
            дараалсан мөрүүд <strong>нэг багц</strong> болно. Энэ төрөлд хэрэгтэй багана: {TYPE_HINTS[format]}.
            <br />
            <strong>level</strong> / <strong>topic</strong> хоосон бол дээрх сонголтоор бөглөгдөнө.
          </p>
          <button onClick={downloadTemplate} className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline">
            <Upload className="h-3 w-3 rotate-180" /> Загвар татах
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) readFile(f); }}
          onClick={() => fileRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-10 transition-colors hover:border-primary hover:bg-primary/5"
        >
          <Upload className="h-10 w-10 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">{fileName || 'Файл сонгох'}</p>
          <p className="text-xs text-gray-400">.csv · чирж оруулж болно</p>
          <input
            ref={fileRef} type="file" accept=".csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }}
          />
        </div>

        {/* Parse report */}
        {parsed && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                <p className="text-xl font-bold text-green-700">{quizzes.length}</p>
                <p className="text-xs text-green-600">Багц</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                <p className="text-xl font-bold text-gray-700">{questionCount}</p>
                <p className="text-xs text-gray-500">Асуулт</p>
              </div>
              <div className={`rounded-lg border p-3 text-center ${rowErrors.length ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                <p className={`text-xl font-bold ${rowErrors.length ? 'text-red-700' : 'text-gray-700'}`}>{rowErrors.length}</p>
                <p className={`text-xs ${rowErrors.length ? 'text-red-600' : 'text-gray-500'}`}>Алдаатай мөр</p>
              </div>
            </div>

            {rowErrors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-2 flex items-center gap-1 text-sm font-medium text-red-700">
                  <AlertCircle className="h-4 w-4" /> Эдгээр мөр алгасагдана
                </p>
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {rowErrors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-xs text-red-600">Мөр {e.row}: {e.message}</p>
                  ))}
                  {rowErrors.length > 5 && (
                    <p className="text-xs text-red-400">…болон {rowErrors.length - 5} бусад мөр</p>
                  )}
                </div>
              </div>
            )}

            {quizzes.length > 0 && (
              <p className="text-xs text-gray-500">
                Үүсэх багцууд: {quizzes.slice(0, 4).map((q) => `«${q.title}» (${q.questions.length})`).join(' · ')}
                {quizzes.length > 4 && ` …+${quizzes.length - 4}`}
              </p>
            )}
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          Шууд нийтлэх
        </label>
        {!publish && (
          <p className="text-xs text-amber-600">
            ⚠️ Нийтлээгүй (ноорог) контент апп дээр огт харагдахгүй — шалгаад "Нийтлэх" дарна уу.
          </p>
        )}

        {failed.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            <p className="mb-1 font-medium">{failed.length} багц хадгалагдсангүй:</p>
            {failed.slice(0, 5).map((f, i) => <p key={i}>{f}</p>)}
          </div>
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
