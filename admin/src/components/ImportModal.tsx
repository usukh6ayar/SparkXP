import { useMemo, useState, type ReactNode } from 'react';
import { Upload, Sparkles } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { FormActions } from './FormActions';
import { ErrorBox } from './ErrorBox';
import { friendlyError } from '../lib/errors';
import { parsePacks, templateCsv, readAnyFile, type Pack } from '../lib/importRows';
import type { QuestionType } from './QuizQuestionsEditor';

/**
 * **Файлаас контент импортлох цонх** — Дасгал ба Сорил хуудас хоёулаа үүнийг
 * ашиглана.
 *
 * Яагаад дундын вэ: хоёр хуудас тус тусдаа ижил цонхтой байсан бөгөөд
 * форматын жишээ, задлагч, алдааны мессеж нь хоёр газарт давхардаж бичигдсэн
 * байв. Үр дүнд нь нэг талыг нь сайжруулахад нөгөө нь хуучнаараа үлдэж,
 * «яагаад миний харж байгаа жишээ өөрчлөгдөөгүй юм бэ» гэсэн асуулт төрүүлсэн.
 * Одоо формат нэг л газар (`lib/importRows.ts` + энэ файл) тодорхойлогдоно.
 *
 * Хуудас бүр зөвхөн **өөрийн талбаруудаа** (гарчиг, түвшин, төрөл…) `fields`
 * -ээр өгч, `onImport`-д ирсэн багцуудыг өөрийн дүрмээр хадгална.
 */
export function ImportModal({
  title,
  questionType,
  fields,
  note,
  multiPack,
  onMultiPack,
  onImport,
  onAi,
  onClose,
}: {
  title: string;
  /** Мөрүүдийг ямар асуулт болгож уншихыг шийднэ. */
  questionType: QuestionType;
  /** Хуудасны өөрийн талбарууд (гарчиг · түвшин · сэдэв · сонсох яриа…). */
  fields: ReactNode;
  /** Доод талын нэг мөр тайлбар (юу болохыг хэлнэ). */
  note: ReactNode;
  /**
   * Эхний багана нь багцын нэр үү. `undefined` бол сонголт огт харагдахгүй
   * (нэг файл = нэг зүйл).
   */
  multiPack?: boolean;
  onMultiPack?: (v: boolean) => void;
  /** Багцуудыг хадгална. Алдаа шидвэл цонхонд харагдана. */
  onImport: (packs: Pack[]) => Promise<void>;
  /** «AI-аар үүсгэх» — буулгасан текстийг дамжуулна. */
  onAi: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const packs = useMemo<Pack[]>(() => {
    try {
      return parsePacks(text, questionType, !!multiPack);
    } catch {
      return [];
    }
  }, [text, questionType, multiPack]);

  async function pickFile(file: File) {
    setError('');
    setBusy(true);
    try {
      setText(await readAnyFile(file));
      setFileName(file.name);
    } catch (e) {
      setError(friendlyError(e, 'Файлыг уншиж чадсангүй'));
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([templateCsv(questionType)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sparkxp-zagvar.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function run() {
    if (packs.length === 0) {
      // Задлагчийн алдааг (ж: «Холбох төрөлд зөвхөн JSON») энд харуулна.
      try {
        parsePacks(text, questionType, !!multiPack);
        setError('Асуулт олдсонгүй');
      } catch (e) {
        setError(friendlyError(e, 'Задлахад алдаа гарлаа'));
      }
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onImport(packs);
    } catch (e) {
      setError(friendlyError(e, 'Импорт амжилтгүй'));
    } finally {
      setBusy(false);
    }
  }

  const totalQuestions = packs.reduce((n, p) => n + p.questions.length, 0);

  return (
    <Modal title={title} onClose={onClose} size="2xl">
      <div className="space-y-4">
        {fields}

        {/* Файлаас — админ Excel/Word дээрээ бэлдээд шууд оруулна. */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <label className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50">
            <Upload className="mr-1 inline h-4 w-4" /> Файл сонгох
            <input
              type="file"
              accept=".xlsx,.xls,.docx,.csv,.tsv,.txt,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void pickFile(f);
                e.target.value = ''; // ижил файлыг дахин сонгож болно
              }}
            />
          </label>
          <span className="flex-1 text-xs text-gray-500">
            {fileName ? (
              <b className="text-gray-700">{fileName}</b>
            ) : (
              'Excel (.xlsx) · Word (.docx) · CSV · TSV · TXT · JSON'
            )}
          </span>
          <Button variant="secondary" size="sm" onClick={downloadTemplate}>
            Загвар татах
          </Button>
        </div>

        {multiPack !== undefined && onMultiPack && (
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={multiPack}
              onChange={(e) => onMultiPack(e.target.checked)}
            />
            <span>
              <b className="text-gray-700">Эхний багана = багцын нэр</b>
              <span className="block text-xs text-gray-500">
                Нэг файлаас олон дасгал үүснэ. Багш 5 багц (тус бүр 15 асуулт)
                өгөх бол файл нь 75 мөртэй, эхний баганад нь багцын нэр байна.
              </span>
            </span>
          </label>
        )}

        <FormatHelp questionType={questionType} multiPack={!!multiPack} />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Өгөгдөл</label>
          <textarea
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            rows={8}
            value={text}
            onChange={(e) => { setText(e.target.value); setFileName(''); }}
            placeholder="Файл сонгох, эсвэл Excel-ээс нүднүүдээ хуулаад энд буулгана уу…"
          />
        </div>

        {/* Урьдчилан харах: «Импортлох» дарахаас өмнө юу орохыг нь хэлнэ. */}
        {packs.length > 0 && (
          <div className="rounded-lg border border-primary/30 bg-primarySoft p-3 text-xs">
            <p className="font-medium text-gray-700">
              {packs.length > 1
                ? `${packs.length} багц · нийт ${totalQuestions} асуулт үүснэ`
                : `1 зүйл · ${totalQuestions} асуулт үүснэ`}
            </p>
            <ul className="mt-1 space-y-0.5 text-gray-600">
              {packs.slice(0, 8).map((pack, i) => (
                <li key={pack.name || i}>
                  • {pack.name || '(нэргүй)'} — {pack.questions.length} асуулт
                </li>
              ))}
              {packs.length > 8 && <li>… +{packs.length - 8}</li>}
            </ul>
          </div>
        )}

        {/* Формат тааруулах цаг заваарахгүй бол — яг тэр текстийг AI-д өгнө. */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primarySoft px-3 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-xs text-gray-600">
            Формат нь таарахгүй байна уу? Дээрх текстээ AI-д өгөөд асуулт болгож
            үүсгүүлж болно — гарчиг, хариулт, оноог нь өөрөө бөглөнө.
          </span>
          <Button variant="secondary" size="sm" onClick={() => onAi(text)}>
            <Sparkles className="h-4 w-4" /> AI-аар үүсгэх
          </Button>
        </div>

        <p className="text-xs text-gray-500">{note}</p>
        <ErrorBox message={error} />
        <FormActions onCancel={onClose} onSave={run} saving={busy} saveLabel="Импортлох" />
      </div>
    </Modal>
  );
}

/** Форматын жишээ — цорын ганц эх сурвалж (хуудас бүрд давтахгүй). */
function FormatHelp({
  questionType,
  multiPack,
}: {
  questionType: QuestionType;
  multiPack: boolean;
}) {
  if (questionType === 'word_match') {
    return (
      <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
        Холбох төрөлд зөвхөн JSON массив дэмжинэ:
        <p className="mt-1 font-mono">
          [{'{'}"type":"word_match","pairs":[{'{'}"left":"cat","right":"муур"{'}'}],"points":10{'}'}]
        </p>
      </div>
    );
  }

  const fill = questionType === 'fill_blank';
  const header = multiPack
    ? fill
      ? 'багц, асуулт, хариулт, оноо'
      : 'багц, асуулт, сонголт 1, сонголт 2, сонголт 3, сонголт 4, зөв (1-4), оноо'
    : fill
      ? 'асуулт, хариулт, оноо'
      : 'асуулт, сонголт 1, сонголт 2, сонголт 3, сонголт 4, зөв (1-4), оноо';
  const rows = multiPack
    ? fill
      ? ['Present Simple 1, She ___ to school., goes, 10',
         'Present Simple 1, They ___ football., play, 10',
         'Present Simple 2, He ___ not like coffee., does, 10']
      : ['Present Simple 1, She ___ to school., go, goes, going, went, 2, 10',
         'Present Simple 1, They ___ football., plays, played, play, playing, 3, 10',
         'Present Simple 2, He ___ not like coffee., do, does, did, doing, 2, 10']
    : fill
      ? ['She ___ to school., goes, 10']
      : ['Нийслэл?, Улаанбаатар, Дархан, Эрдэнэт, Чойбалсан, 1, 10'];

  return (
    <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
      <p className="font-medium text-gray-700">
        Формат — мөр бүр = 1 асуулт. Тусгаарлагч нь <b>таслал</b> (Excel-ийн CSV),{' '}
        <b>таб</b> (Excel-ээс шууд буулгасан) эсвэл <b>|</b> аль нь ч байж болно:
      </p>
      <pre className="mt-1 overflow-x-auto whitespace-pre font-mono text-[11px] leading-5 text-gray-600">
        {[header, ...rows].join('\n')}
      </pre>
      <p className="mt-1">
        Excel/Word файлыг шууд сонгож болно. Эхний мөрөнд «багц» гэсэн толгой
        байвал алгасна; асуултын текст доторх таслалыг Excel өөрөө хашилтад
        оруулдаг тул зөв уншигдана. Эсвэл JSON массив ([{'{'}…{'}'}) буулгаж болно.
      </p>
    </div>
  );
}
