import { useEffect, useRef, useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { api } from '../api/client';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import { ErrorBox } from './ErrorBox';
import { JobProgress } from './JobProgress';
import { friendlyError } from '../lib/errors';
import { levelFormOptions } from '../lib/options';
import { toggleInSet } from '../lib/utils';

/**
 * "Бүх төрлөөр үүсгэх" — нэг товчоор бүхэл түвшний контент бэлдэх.
 *
 * `AiBulkGenerator`-аас ялгаа: тэр нь админы **бичсэн агуулгаас нэг** дасгал
 * үүсгээд preview үзүүлдэг; энэ нь **агуулга огт бичихгүйгээр** төрөл бүрт N
 * дасгал үүсгээд шууд хадгална. Тиймээс preview байхгүй — оронд нь backend
 * давхардлыг хасаж, чанарын шалгуураар шүүнэ.
 *
 * Дасгал · Сорил · IELTS гурвуулаа нэг `Quiz` хүснэгт дээр суудаг тул энэ ч
 * гурвуулангийнх (CODING_RULES §0.2) — хуудас бүр өөрийн төрлүүдээ
 * `targets`-аар дамжуулна.
 */
export interface BulkTargetOption {
  /**
   * Жагсаалт доторх давтагдашгүй түлхүүр. `category` биш болсон шалтгаан:
   * Сорилын 6 тоглоом БҮГД `category: 'soril'` — ялгаа нь зөвхөн `quizType`.
   */
  key: string;
  /** `Quiz.category` — апп контентыг үүгээр татдаг. */
  category: string;
  /** Админд харагдах нэр — ж: "Сонсгол". */
  label: string;
  /**
   * Тараах сэдвүүд (`Quiz.topic`). Апп дасгалыг сэдвээр нь бүлэглэдэг тул
   * хуудасны бэлэн жагсаалтыг дамжуулна — эс бөгөөс AI сэдэв зохиож, аппын
   * бүлгүүд хэлтэрхийлнэ.
   */
  topics?: string[];
  questionType?: string;
  quizType?: string;
  contextNote?: string;
}

const COUNT_OPTIONS = (max: number) =>
  Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

const QUESTION_OPTIONS = [5, 8, 10, 15, 20].map((n) => ({
  value: String(n),
  label: `${n} асуулт`,
}));

/** Нэг дасгал ≈ 5 секунд, зэрэг 3 явдаг тул нийтийг 3-т хуваана. */
function estimateMinutes(total: number): string {
  const seconds = Math.ceil((total * 5) / 3);
  return seconds < 90 ? `${seconds} сек` : `${Math.ceil(seconds / 60)} мин`;
}

interface ModalProps {
  kind: 'exercise' | 'lesson' | 'ielts';
  /** Модалын гарчигт орох нэр — ж: "Дасгал". */
  title: string;
  targets: BulkTargetOption[];
  defaultXp: number;
  onClose: () => void;
  /** Ажил эхэлмэгц — эцэг хуудас явцыг харуулна. */
  onStarted: (jobId: string) => void;
}

export function BulkGenerateModal({
  kind, title, targets, defaultXp, onClose, onStarted,
}: ModalProps) {
  const [level, setLevel] = useState('a1');
  const [perTarget, setPerTarget] = useState('10');
  const [questionCount, setQuestionCount] = useState('10');
  // Анхдагчаар бүх төрөл сонгогдсон — "бүх төрлөөр" гэдэг нь энэ товчны утга учир.
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(targets.map((t) => t.key)),
  );
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const chosen = targets.filter((t) => picked.has(t.key));
  const total = chosen.length * Number(perTarget);

  function toggle(key: string) {
    setPicked((s) => {
      const next = new Set(s);
      toggleInSet(next, key);
      return next;
    });
  }

  async function start() {
    if (chosen.length === 0) {
      setError('Дор хаяж нэг төрөл сонгоно уу');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const res = await api.post<{ jobId: string }>('/quizzes/bulk-generate', {
        kind,
        level,
        perTarget: Number(perTarget),
        questionCount: Number(questionCount),
        xpReward: defaultXp,
        targets: chosen.map((t) => ({
          category: t.category,
          label: t.label,
          topics: t.topics,
          questionType: t.questionType,
          quizType: t.quizType,
          contextNote: t.contextNote,
        })),
      });
      onStarted(res.jobId);
      onClose();
    } catch (e: unknown) {
      setError(friendlyError(e, 'Эхлүүлэхэд алдаа гарлаа'));
    } finally {
      setStarting(false);
    }
  }

  return (
    <Modal title={`Бүх төрлөөр үүсгэх — ${title}`} onClose={onClose} size="lg">
      <div className="space-y-4">
        <p className="rounded-lg bg-primarySoft px-3 py-2 text-sm text-gray-600">
          Агуулга бичих шаардлагагүй — түвшингээ сонгоход AI төрөл бүрийн онцлогт
          тохирсон дасгал бэлдэнэ. Аль хэдийн байгаа контенттой{' '}
          <strong>давхцуулахгүй</strong>.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Түвшин"
            options={levelFormOptions}
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          />
          <Select
            label="Төрөл бүрт хэдэн дасгал"
            options={COUNT_OPTIONS(10)}
            value={perTarget}
            onChange={(e) => setPerTarget(e.target.value)}
          />
          <Select
            label="Нэг дасгалд"
            options={QUESTION_OPTIONS}
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            Ямар төрлүүдэд үүсгэх вэ?
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {targets.map((t) => (
              <label
                key={t.key}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                  picked.has(t.key)
                    ? 'border-primary bg-primary/5 font-medium'
                    : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={picked.has(t.key)}
                  onChange={() => toggle(t.key)}
                  className="h-4 w-4 rounded border-gray-300 accent-primary"
                />
                {t.label}
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm">
          Нийт <strong>{total}</strong> дасгал үүснэ ({chosen.length} төрөл ×{' '}
          {perTarget}) · ойролцоогоор <strong>{estimateMinutes(total)}</strong>
          <p className="mt-1 text-xs text-gray-500">
            Үүсгэсэн дасгал шууд нийтлэгдэнэ. Цонхыг хааж, ажлаа үргэлжлүүлж
            болно — явц хуудсан дээр харагдана.
          </p>
        </div>

        <ErrorBox message={error} />

        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <Button variant="secondary" onClick={onClose} disabled={starting}>
            Болих
          </Button>
          <Button onClick={start} disabled={starting || total === 0}>
            <Sparkles className="h-4 w-4" />
            {starting ? 'Эхлүүлж байна…' : `${total} дасгал үүсгэх`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Явц ─────────────────────────────────────────────────────────────────────

interface JobState {
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: { key: string; message: string }[];
  done?: boolean;
  canceled?: boolean;
  current?: string;
  expired?: boolean;
}

const EMPTY: JobState = {
  total: 0, processed: 0, created: 0, skipped: 0, failed: [],
};

/**
 * Ажлын явцыг татаж, `JobProgress`-оор харуулна. Ажиллах явцад жагсаалтыг
 * шинэчилдэг тул шинэ дасгалууд нүдэн дээр нэмэгдэж харагдана.
 */
export function BulkGenerateProgress({
  jobId, onRefresh, onClose,
}: {
  jobId: string;
  /** Хүснэгтээ шинэчлэх — шинэ мөр орж ирэхэд нь харуулна. */
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [job, setJob] = useState<JobState>(EMPTY);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Хамгийн сүүлийн `onRefresh`-ийг ашиглана — эцэг хуудас бүрт шинэ функц
  // үүсгэдэг тул үүнийг dependency болговол polling дахин дахин эхэлнэ.
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;

  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      try {
        const next = await api.get<JobState>(`/quizzes/bulk-generate/${jobId}`);
        if (stopped) return;
        setJob((prev) => ({ ...prev, ...next }));
        refresh.current();
        if (next.done || next.expired) return;
      } catch {
        return; // сүлжээ тасарвал зогсооно — хэрэглэгч хуудсаа сэргээнэ
      }
      if (!stopped) timer.current = setTimeout(tick, 2500);
    };
    timer.current = setTimeout(tick, 1500);
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [jobId]);

  async function cancel() {
    setJob((j) => ({ ...j, canceled: true }));
    try {
      await api.post(`/quizzes/bulk-generate/${jobId}/cancel`, {});
    } catch {
      /* дараагийн татах үед бодит төлөв нь харагдана */
    }
  }

  const label = job.done
    ? job.canceled
      ? '🛑 Зогсоосон'
      : '✅ Үүсгэж дууслаа'
    : job.canceled
      ? '🛑 Зогсоож байна… (эхэлсэн дасгалууд дуусна)'
      : `✨ AI дасгал үүсгэж байна${job.current ? ` — ${job.current}` : ''}`;

  return (
    <JobProgress
      label={label}
      processed={job.processed}
      total={job.total}
      done={job.done}
      canceling={job.canceled}
      onCancel={cancel}
      onClose={onClose}
      stats={
        <>
          {' '}· үүссэн <strong>{job.created}</strong>
          {job.skipped > 0 && <> · давхардсан {job.skipped}</>}
        </>
      }
      failures={job.failed}
      note={
        job.done
          ? undefined
          : 'Энэ хуудсыг хаасан ч сервер дээр үргэлжилнэ — зөвхөн явц харагдахаа болино.'
      }
    />
  );
}

/** Хуудасны толгойд тавих товч — гурван хуудсанд ижил харагдана. */
export function BulkGenerateButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="secondary" onClick={onClick} title="Түвшин сонгоод бүх төрөлд дасгал бэлдэх">
      <Wand2 className="h-4 w-4" /> Бүх төрлөөр үүсгэх
    </Button>
  );
}
