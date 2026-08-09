import { useState } from 'react';
import { Sparkles, AlertTriangle, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { FormActions } from './FormActions';
import { levelFormOptions } from '../lib/options';
import { QuizQuestionsEditor, type Question, type QuestionType } from './QuizQuestionsEditor';

/**
 * "AI-аар үүсгэх" — Дасгал · Сорил · IELTS **гурвуулангийн** дундын үүсгэгч.
 *
 * Гурвуулаа нэг `Quiz` entity дээр (ялгаа нь зөвхөн `category` / `quizType` /
 * `lessonId`) тул үүсгэх урсгал ч нэг л удаа бичигдэнэ (CODING_RULES §0.2).
 * Хуудас бүр өөрийн ялгааг `target`-аар дамжуулна.
 *
 * Урсгал: агуулгаа бичнэ → AI үүсгэнэ → **preview дээр засна** → хадгална.
 * Preview дээр асуулт бүрийг харж, засаж байж хадгалдаг тул анхдагчаар
 * **нийтэлнэ**; шалгах шаардлагатай бол "Шууд нийтлэх"-ийг тайлж ноорог болгоно.
 * (Урьд нь үргэлж ноорог байсан нь "AI-аар үүсгэсэн контент апп дээр гарахгүй"
 * гэсэн гомдлын гол шалтгаан байв.)
 */
export interface AiTarget {
  /** Prompt-ийн контекстийг сонгоно. */
  kind: 'exercise' | 'lesson' | 'ielts';
  /** Модалын гарчигт харагдах нэр — ж: "Сонсгол дасгал". */
  label: string;
  /** Quiz.category — AI-д контекст болж, хадгалахад ч бичигдэнэ. */
  category?: string;
  /** Тогтмол асуултын формат. Өгөөгүй бол админ сонгоно (эсвэл AI шийднэ). */
  questionType?: QuestionType;
  /** Сэдэв сонголтууд. Өгөөгүй бол сэдвийн талбар харагдахгүй. */
  topicOptions?: { value: string; label: string }[];
  /** `POST /quizzes`-ийн биед нэмж явуулах талбарууд (quizType, lessonId г.м.). */
  save?: Record<string, unknown>;
  /** Анхдагч XP шагнал. */
  xpReward: number;
  /** Prompt-д нэмэх нэмэлт контекст (хичээлийн тайлбар, тоглоомын төрөл г.м.). */
  contextNote?: string;
  /** IELTS Reading — эх бичвэрийн талбарыг харуулах. */
  withPassage?: boolean;
  /**
   * Түвшний талбарын анхдагч утга (ж: хичээлийн тест → тухайн хичээлийн түвшин).
   * Өгөөгүй бол "AI сонгоно" — админ гараар сонгож болно.
   */
  defaultLevel?: string;
}

interface Draft {
  title: string;
  level: string;
  questionType: QuestionType;
  topic: string | null;
  passageText: string | null;
  questions: Question[];
  warnings: string[];
}

interface Props {
  target: AiTarget;
  onClose: () => void;
  /** Хадгалсны дараа — эцэг хуудас жагсаалтаа шинэчилнэ. */
  onSaved: () => void;
}

const AUTO = ''; // "AI өөрөө сонгоно" гэсэн утга

const TYPE_OPTIONS = [
  { value: AUTO, label: '✨ AI өөрөө сонгоно' },
  { value: 'multiple_choice', label: 'Олон сонголт' },
  { value: 'fill_blank', label: 'Хоосон нөхөх' },
  { value: 'word_match', label: 'Холбох' },
  { value: 'open_response', label: 'Задгай хариулт' },
];

const COUNT_OPTIONS = [5, 10, 15, 20].map((n) => ({ value: String(n), label: `${n} асуулт` }));

/** Асуултуудыг ойролцоогоор тэнцүү `parts` хэсэгт хуваана. */
function chunk(questions: Question[], parts: number): Question[][] {
  if (parts <= 1) return [questions];
  const size = Math.ceil(questions.length / parts);
  const out: Question[][] = [];
  for (let i = 0; i < questions.length; i += size) out.push(questions.slice(i, i + size));
  return out;
}

export function AiBulkGenerator({ target, onClose, onSaved }: Props) {
  // ── 1-р алхам: юу үүсгэх вэ ──
  const [brief, setBrief] = useState('');
  const [level, setLevel] = useState(target.defaultLevel ?? AUTO);
  const [qType, setQType] = useState<string>(target.questionType ?? AUTO);
  const [count, setCount] = useState('10');
  const [passageText, setPassageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── 2-р алхам: preview (админ засна) ──
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [xpReward, setXpReward] = useState(target.xpReward);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [splitInto, setSplitInto] = useState('1');
  const [publish, setPublish] = useState(true);
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (brief.trim().length < 3) {
      setError('Юу үүсгэхээ бичнэ үү');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const d = await api.post<Draft>('/quizzes/ai-generate', {
        brief: brief.trim(),
        kind: target.kind,
        category: target.category,
        topic: topic || undefined,
        level: level || undefined,
        questionType: qType || undefined,
        count: Number(count),
        passageText: passageText.trim() || undefined,
        contextNote: target.contextNote,
      });
      setDraft(d);
      setTitle(d.title);
      setTopic(d.topic ?? '');
      setQuestions(d.questions);
      setSplitInto('1');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Үүсгэхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!draft) return;
    if (!title.trim()) {
      setError('Гарчиг оруулна уу');
      return;
    }
    if (questions.length === 0) {
      setError('Дор хаяж нэг асуулт үлдээнэ үү');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const parts = chunk(questions, Number(splitInto));
      // Хуваасан үед гарчигт дугаар нэмнэ (1/3, 2/3 …).
      for (const [i, part] of parts.entries()) {
        await api.post('/quizzes', {
          title: parts.length > 1 ? `${title.trim()} (${i + 1}/${parts.length})` : title.trim(),
          level: draft.level,
          category: target.category,
          topic: topic || undefined,
          quizType: draft.questionType,
          questions: part,
          xpReward,
          isPublished: publish,
          passageText: draft.passageText ?? undefined,
          ...target.save,
        });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  }

  const errorBox = error && (
    <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
  );

  // ── Preview дэлгэц ──
  if (draft) {
    return (
      <Modal title={`Шалгаад хадгална уу — ${target.label}`} onClose={onClose} size="2xl">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setDraft(null)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
            >
              <ArrowLeft className="h-4 w-4" /> Буцаад дахин үүсгэх
            </button>
            <span className="text-sm text-gray-500">
              {questions.length} асуулт · {draft.level.toUpperCase()}
            </span>
          </div>

          {/* AI-гийн чанарын шалгуурт илэрсэн зүйлс */}
          {draft.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Анхаарах ({draft.warnings.length})
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                {draft.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Гарчиг" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input
              label="XP шагнал"
              type="number"
              min={0}
              value={xpReward}
              onChange={(e) => setXpReward(Number(e.target.value))}
            />
            {target.topicOptions && (
              <Select
                label="Сэдэв"
                options={target.topicOptions}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            )}
            <Select
              label="Хэдэн хэсэг болгох"
              options={[1, 2, 3, 4].map((n) => ({
                value: String(n),
                label: n === 1 ? '1 (бүгдийг нэг дор)' : `${n} тусдаа`,
              }))}
              value={splitInto}
              onChange={(e) => setSplitInto(e.target.value)}
            />
          </div>

          {draft.passageText && (
            <div>
              <label className="text-sm font-medium text-gray-700">Эх бичвэр</label>
              <textarea
                className="mt-1 h-32 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                value={draft.passageText}
                onChange={(e) => setDraft({ ...draft, passageText: e.target.value })}
              />
            </div>
          )}

          <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-gray-100 p-2">
            <QuizQuestionsEditor
              questionType={draft.questionType}
              questions={questions}
              onChange={setQuestions}
            />
          </div>

          {errorBox}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
            Шууд нийтлэх
          </label>
          {!publish && (
            <p className="text-xs text-gray-500">
              ⚠️ Ноорог болж хадгалагдана — апп дээр гарахгүй. Жагсаалтаас шалгаад
              "Нийтлэх" дарна уу.
            </p>
          )}
          <FormActions
            onCancel={onClose}
            onSave={save}
            saving={saving}
            saveLabel={publish ? 'Нийтлэж хадгалах' : 'Ноорог болгож хадгалах'}
          />
        </div>
      </Modal>
    );
  }

  // ── Агуулга бичих дэлгэц ──
  return (
    <Modal title={`AI-аар үүсгэх — ${target.label}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Юу үүсгэх вэ?</label>
          <textarea
            className="mt-1 h-40 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            placeholder={
              'Агуулгаа чөлөөтэй бичнэ үү. Жишээ:\n\n' +
              '"Present Perfect цагийн хэрэглээ дээр дасгал. Сурагчид has/have ялгаж чаддаг болох ёстой."\n\n' +
              'Эсвэл бэлэн текст/өгүүллэгээ шууд буулгаад өгч болно — AI түүн дээр асуулт зохионо.'
            }
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Excel хэрэггүй — агуулгаа бичихэд AI түвшин, төрөл, сэдвийг нь өөрөө таамаглана.
          </p>
        </div>

        {target.withPassage && (
          <div>
            <label className="text-sm font-medium text-gray-700">
              Эх бичвэр <span className="text-gray-400">(заавал биш — хоосон бол AI зохионо)</span>
            </label>
            <textarea
              className="mt-1 h-28 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
              placeholder="IELTS Reading-ийн эх бичвэрээ энд буулгана уу..."
              value={passageText}
              onChange={(e) => setPassageText(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <Select
            label="Түвшин"
            options={[{ value: AUTO, label: '✨ AI сонгоно' }, ...levelFormOptions]}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          {/* Формат тогтсон хуудсанд (Сорил, IELTS Writing) сонголт харуулахгүй. */}
          {!target.questionType && (
            <Select
              label="Асуултын төрөл"
              options={TYPE_OPTIONS}
              value={qType}
              onChange={(e) => setQType(e.target.value)}
            />
          )}
          <Select
            label="Тоо"
            options={COUNT_OPTIONS}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>

        {errorBox}

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Болих
          </Button>
          <Button onClick={generate} disabled={loading}>
            <Sparkles className="h-4 w-4" />
            {loading ? 'AI үүсгэж байна…' : 'Үүсгэх'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
