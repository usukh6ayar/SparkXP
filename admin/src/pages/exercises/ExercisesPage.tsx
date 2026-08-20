import { useState, useEffect, useCallback } from 'react';
import { Plus, Upload, Trash2, Sparkles } from 'lucide-react';
import { AiBulkGenerator } from '../../components/AiBulkGenerator';
import { HiddenBadge, VisibilityButton, UnpublishedBanner } from '../../components/Publish';
import { TopicField } from '../../components/AssignmentBank';
import { BulkGenerateModal, BulkGenerateProgress, BulkGenerateButton } from '../../components/BulkGenerate';
import { ErrorBox } from '../../components/ErrorBox';
import { QualityPanel, type QualityRow } from '../../components/QualityPanel';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';
import { Pagination } from '../../components/Pagination';
import { levelFormOptions as LEVEL_OPTIONS, exerciseCategoryOptions, EXERCISE_CATEGORIES } from '../../lib/options';
import {
  QuizQuestionsEditor,
  type Question,
  type QuestionType,
} from '../../components/QuizQuestionsEditor';
import ReadingPage from '../reading/ReadingPage';
import { SpeakingPanel } from './SpeakingPanel';
import { toggleInSet } from '../../lib/utils';
import type { Pack } from '../../lib/importRows';
import { ImportModal } from '../../components/ImportModal';

const LIMIT = 20;

/**
 * Даалгаврын сангийн таб/`Quiz.category` утга.
 *
 * ⚠️ Аюулгүй байдлын хил нь ЭНЭ БИШ — тэр нь `Quiz.assignOnly` (сервер
 * сурагчийн бүх жагсаалтаас SQL түвшинд хасдаг). `category` нь зөвхөн админ
 * дээр «энэ нь тусдаа сан» гэдгийг харуулах бөгөөд аппад **уншигч дэлгэцгүй**
 * байх ёстой — сурагчийн ямар ч дэлгэц энэ ангиллыг татдаггүй.
 */
const BANK_CAT = 'assignment';

/**
 * Дасгалын ангилалууд. `key` = `Quiz.category` бөгөөд апп дээрх
 * `/skill/<key>` дэлгэцтэй ЯГ таарах ёстой (`mobile/app/skill/[key].tsx`).
 * Speaking = одоохондоо "тун удахгүй".
 *
 * `fill` (Нөхөх) ба `grammar` (Дүрэм) нь аппд аль хэдийн дэлгэцтэй (Сорил
 * табын "Дүүргэх"/"Дүрэм" карт) мөртлөө админд оруулах газаргүй байсан тул
 * тэр хоёр дэлгэц үргэлж хоосон байв.
 */
const CATS = [
  { key: 'listening', label: 'Сонсгол' },
  { key: 'reading', label: 'Унших' },
  { key: 'writing', label: 'Бичих' },
  { key: 'speaking', label: 'Дуудлага' },
  { key: 'fill', label: 'Нөхөх' },
  { key: 'grammar', label: 'Дүрэм' },
  // ⚠️ Энэ нь ур чадвар БИШ — **багшийн даалгаврын сан** (`Quiz.assignOnly`).
  // Урьд нь ангилал бүрийн дотор нуугдсан «хамрах хүрээ» шүүлтүүр байсан тул
  // хаана байгааг нь хэн ч олдоггүй байв. Одоо Сонсгол/Унших/Бичихтэй нэг
  // эгнээнд, өөрийн табтай: сурагчид ОГТ харагдахгүй дасгалууд зөвхөн энд.
  { key: BANK_CAT, label: 'Даалгавар' },
] as const;

/**
 * Сонсох яриа хамгийн багадаа хэдэн тэмдэгт байх вэ — backend-ийн
 * `MIN_LISTENING_SCRIPT`-тэй ижил байх ёстой (`backend/src/quizzes/ai-generate.ts`).
 */
const MIN_SCRIPT = 40;

/*
 * Чанарын шалгуурыг энд давхардуулж бичихгүй — backend-ийн `quality.ts` бол
 * цорын ганц эх сурвалж (DRY). Эс бөгөөс хоёр газарт өөр дүрэм үүсээд, админд
 * "зүгээр" харагдсан дасгал аппаас нуугдаж, шалтгаан нь ойлгомжгүй болно.
 * Төрөл + харуулах UI → `components/QualityPanel.tsx`.
 */

/**
 * "Бүх төрлөөр үүсгэх"-д орох төрлүүд. `speaking` (тун удахгүй) ба `reading`
 * (өөрийн `ReadingPassage` хуудастай) хоёр орохгүй — тэднийг энд үүсгэвэл апп
 * дээр хүрэх дэлгэцгүй мөр болно.
 *
 * `topics` нь аппын бүлэглэлт (`mobile/app/skill/[key].tsx` нь дасгалыг
 * `topic`-оор нь бүлэглэдэг) — AI-д сэдэв зохиолгохын оронд байгаа бүлгүүд рүү
 * тараана.
 */
const BULK_TARGETS = CATS
  // `assignment` (сан) энд ОРОХГҮЙ: энэ модал нь сурагчид нээлттэй дасгал
  // үүсгэдэг (assignOnly бичдэггүй) тул сан руу үүсгэх бол тухайн таб дээрх
  // «AI-аар үүсгэх»-ийг ашиглана.
  .filter((c) => c.key !== 'speaking' && c.key !== 'reading' && c.key !== BANK_CAT)
  .map((c) => ({
    key: c.key,
    category: c.key,
    label: c.label,
    topics: EXERCISE_CATEGORIES[c.key] ?? [],
  }));

const QTYPE_OPTIONS = [
  { value: 'multiple_choice', label: 'Олон сонголт' },
  { value: 'fill_blank', label: 'Нөхөх' },
  { value: 'word_match', label: 'Үг буудах' },
];

interface Exercise {
  id: string;
  title: string;
  level: string;
  category: string | null;
  topic: string | null;
  quizType: string | null;
  xpReward: number;
  isPublished: boolean;
  /** Зөвхөн даалгавраар нээгддэг «багшийн сан» мөр эсэх. */
  assignOnly: boolean;
  questions: Question[];
  passageText: string | null;
  audioUrl: string | null;
}

interface Form {
  title: string;
  level: string;
  topic: string;
  questionType: QuestionType;
  questions: Question[];
  xpReward: number;
  /** Сонсголын дасгал: аппын дуугаар уншуулах яриа. Бусад ангилалд хоосон. */
  passageText: string;
  audioUrl: string;
}
// "Ноорог" төлөв формд байхгүй: Хадгалах = шууд нийтлэх (`components/Publish.tsx`).
const emptyForm: Form = {
  title: '', level: 'a1', topic: '', questionType: 'multiple_choice', questions: [], xpReward: 50,
  passageText: '',
  audioUrl: '',
};

export default function ExercisesPage() {
  const [cat, setCat] = useState<string>('listening');
  /** Даалгаврын сангийн таб дээр байна уу — жагсаалт, форм, импорт бүгд үүнийг дагана. */
  const bank = cat === BANK_CAT;
  const [items, setItems] = useState<Exercise[]>([]);
  /** Серверийн чанарын тайлан, дасгалын id-гаар. */
  const [quality, setQuality] = useState<Map<string, QualityRow>>(new Map());
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Selection (bulk publish/delete)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [publishingAll, setPublishingAll] = useState(false);
  // AI-аар үүсгэх (дундын AiBulkGenerator)
  const [aiOpen, setAiOpen] = useState(false);
  /** Импортын цонхонд буулгасан текстийг AI руу дамжуулах үед л дүүрнэ. */
  const [aiBrief, setAiBrief] = useState('');
  // Бүх төрлөөр үүсгэх (background job)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkJobId, setBulkJobId] = useState<string | null>(null);
  // CSV/JSON import
  const [importOpen, setImportOpen] = useState(false);
  const [impTitle, setImpTitle] = useState('');
  const [impLevel, setImpLevel] = useState('a1');
  const [impTopic, setImpTopic] = useState('');
  const [impType, setImpType] = useState<QuestionType>('multiple_choice');
  /** Сонсголын импортод заавал — асуултууд энэ яриан дээр тулгуурлана. */
  const [impScript, setImpScript] = useState('');
  /** Эхний багана нь багцын нэр үү. Санд анхдагчаар тийм. */
  const [impMultiPack, setImpMultiPack] = useState(true);

  const load = useCallback(async () => {
    if (cat === 'speaking' || cat === 'reading') { setItems([]); return; }
    /*
     * Хоёр тусдаа жагсаалт, огтлолцохгүй:
     *  - **Даалгаврын сан** = `assignOnly=true` бүх мөр (ангиллаас үл хамааран,
     *    учир нь хуучин сангийн мөрүүд `listening`/`grammar` гэх мэт
     *    ангилалтай хэвээр үлдсэн).
     *  - **Ур чадварын таб** = `assignOnly=false` — сангийн дасгал сурагчийн
     *    контентын дунд хэзээ ч харагдахгүй («яагаад энэ апп дээр гарахгүй
     *    байна вэ» гэсэн эргэлзээний эх үүсвэр байсан).
     *
     * `includeUnanswerable=true` — сервер нь хариулах боломжгүй дасгалыг
     * анхдагчаар нуудаг (сурагч руу гаргахгүйн тулд). Админ л тэдгээрийг
     * хараад засах ёстой тул энд зориудаар асаана.
     */
    const listQuery = bank
      ? 'standalone=true&assignOnly=true'
      : `standalone=true&category=${cat}&assignOnly=false`;
    const [data, report] = await Promise.all([
      api.get<{ items: Exercise[] }>(
        `/quizzes?${listQuery}&limit=200&includeUnanswerable=true`,
      ),
      api.get<{ items: QualityRow[] }>(
        `/quizzes/quality-report${bank ? '' : `?category=${cat}`}`,
      ),
    ]);
    setItems(data.items ?? []);
    setQuality(new Map((report.items ?? []).map((r) => [r.id, r])));
    setSelected(new Set());
  }, [cat, bank]);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    // Таб нь юу үүсэхийг шийднэ: «Даалгавар» табад нэмсэн бүхэн санд орно.
    setForm({ ...emptyForm });
    setEditing(null); setError(''); setModal('create');
  }
  function openEdit(ex: Exercise) {
    const qt = (ex.quizType as QuestionType) || (ex.questions[0]?.type ?? 'multiple_choice');
    setForm({
      title: ex.title, level: ex.level, topic: ex.topic ?? '', questionType: qt,
      questions: ex.questions ?? [], xpReward: ex.xpReward,
      passageText: ex.passageText ?? '',
      audioUrl: ex.audioUrl ?? '',
    });
    setEditing(ex); setError(''); setModal('edit');
  }

  function changeType(qt: QuestionType) {
    // Switching format resets questions (different shape).
    setForm((f) => ({ ...f, questionType: qt, questions: f.questions.filter((q) => q.type === qt) }));
  }

  async function save() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    if (form.questions.length === 0) { setError('Дор хаяж нэг асуулт нэмнэ үү'); return; }
    // Сонсох яриагүй сонсголын дасгал = хариулах боломжгүй дасгал. Сурагч
    // асуултын хариултыг хаанаас ч олохгүй тул таамаглана. Сервер ч үүнийг
    // татгалзана — энд шалгаснаар админ шалтгааныг нь шууд, ойлгомжтой харна.
    // Сонсох зүйлгүй сонсголын дасгал = хариулах боломжгүй. Хоёр замын аль нэг
    // хангалттай: бодит бичлэг (audioUrl) ЭСВЭЛ апп дуугаар уншдаг яриа.
    if (
      cat === 'listening' &&
      !form.audioUrl.trim() &&
      form.passageText.trim().length < MIN_SCRIPT
    ) {
      setError(
        'Сонсох зүйл алга. Бичлэгийн холбоос тавих эсвэл ярианы бичвэрийг ' +
        'бөглөнө үү — эс бөгөөс сурагч асуултын хариултыг хаанаас ч олохгүй.',
      );
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        title: form.title.trim(),
        level: form.level,
        category: cat, // standalone exercise → category = skill, no lessonId
        topic: form.topic, // сэдэв within the skill ('' = no topic)
        quizType: form.questionType,
        questions: form.questions,
        xpReward: form.xpReward,
        // Зөвхөн сонсголд утгатай — бусад ангилалд хоосон явуулж цэвэрлэнэ.
        passageText: cat === 'listening' ? form.passageText.trim() || undefined : undefined,
        audioUrl: cat === 'listening' ? form.audioUrl.trim() || undefined : undefined,
        isPublished: true, // хадгалсан контент шууд аппад гарна
        // Хаана байгаа нь юу болохыг шийднэ — формд checkbox байхаа больсон.
        assignOnly: bank,
      };
      if (modal === 'create') await api.post('/quizzes', payload);
      else if (editing) await api.patch(`/quizzes/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function togglePublish(ex: Exercise) {
    await api.patch(`/quizzes/${ex.id}`, { isPublished: !ex.isPublished });
    load();
  }
  async function remove(id: string) {
    if (!confirm('Дасгал устгах уу?')) return;
    await api.delete(`/quizzes/${id}`);
    load();
  }

  // ── Selection + bulk actions ──
  function toggleRow(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      toggleInSet(n, id);
      return n;
    });
  }
  function toggleAll() {
    setSelected((s) => (paged.every((i) => s.has(i.id)) ? new Set() : new Set(paged.map((i) => i.id))));
  }
  async function bulkPublish(isPublished: boolean) {
    await Promise.all([...selected].map((id) => api.patch(`/quizzes/${id}`, { isPublished })));
    load();
  }
  /** Хуучин ноорог мөрүүдийг нэг товчоор нийтлэх (баннераас). */
  async function publishAllHidden() {
    setPublishingAll(true);
    try {
      await Promise.all(hidden.map((e) => api.patch(`/quizzes/${e.id}`, { isPublished: true })));
      load();
    } finally { setPublishingAll(false); }
  }
  /**
   * Сонгосон мөрүүдийг санд оруулах/гаргах. Excel-ээс багцаар импортолсны
   * дараа нэг товчоор бүхэлд нь санд шилжүүлэх гол зам.
   */
  async function bulkSetBank(assignOnly: boolean) {
    await Promise.all(
      [...selected].map((id) => api.patch(`/quizzes/${id}`, { assignOnly })),
    );
    load();
  }
  async function bulkDelete() {
    if (!confirm(`${selected.size} дасгал устгах уу?`)) return;
    await Promise.all([...selected].map((id) => api.delete(`/quizzes/${id}`)));
    load();
  }

  // ── Файл / CSV / JSON импорт ──
  // Задлагч нь `lib/importRows.ts`-д: Excel-ийн CSV (таслал), Excel-ээс шууд
  // буулгасан (таб), гараар бичсэн (|) гурвуулан ижил кодоор уншигдана.

  /**
   * Импорт. **Нэг файл → олон дасгал**: багцын багана нь мөрүүдийг тусад нь
   * хуваадаг тул «5 багц × 15 асуулт» гэсэн нэг файл 5 дасгал үүсгэнэ.
   * Тэдгээр нь багшийн нэг даалгаврын 5 багц болж очно.
   */
  async function runImport(packs: Pack[]) {
    if (!impTitle.trim()) throw new Error('Гарчиг оруулна уу');
    if (cat === 'listening' && impScript.trim().length < MIN_SCRIPT) {
      throw new Error('Сонсох яриаг бөглөнө үү — яриагүй бол сурагч зөвхөн таамаглана.');
    }
    // Дараалан илгээнэ (зэрэг биш): 5-10 дасгал бол ялгаа мэдэгдэхгүй, харин
    // алдаа гарвал хаана зогссоныг нь хэлж чадна.
    for (const pack of packs) {
      await api.post('/quizzes', {
        // Багцын нэр байвал гарчигт залгана — админы жагсаалтад «Present
        // Simple · Багц 2» гэж ялгарч харагдана.
        title: pack.name ? `${impTitle.trim()} · ${pack.name}` : impTitle.trim(),
        level: impLevel, category: cat, topic: impTopic,
        quizType: impType, questions: pack.questions, xpReward: 50, isPublished: true,
        assignOnly: bank,
        ...(cat === 'listening' ? { passageText: impScript.trim() } : {}),
      });
    }
    setImportOpen(false); setImpTitle(''); setImpScript('');
    load();
  }

  // Шүүлт нь СЕРВЕР дээр хийгдэж байна (`assignOnly` query) — энд давхар
  // шүүхгүй, эс бөгөөс хоёр газарт хоёр өөр дүрэм үүснэ.
  const visible = items;
  const total = visible.length;
  const paged = visible.slice((page - 1) * LIMIT, page * LIMIT);
  const hidden = items.filter((e) => !e.isPublished);
  /** Сервер эдгээрийг аппаас нууж байна — засахгүй бол сурагч хэзээ ч харахгүй. */
  const broken = items.filter((e) => quality.get(e.id)?.blocked);
  /** Магадгүй эвдэрсэн — хүн шийднэ (аппад харагдсаар байна). */
  const suspect = items.filter(
    (e) => quality.has(e.id) && !quality.get(e.id)?.blocked,
  );
  const allChecked = paged.length > 0 && paged.every((e) => selected.has(e.id));
  const columns = [
    {
      key: 'sel',
      header: <input type="checkbox" checked={allChecked} onChange={toggleAll} />,
      render: (e: Exercise) => <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggleRow(e.id)} />,
      className: 'w-8',
    },
    {
      key: 'title', header: 'Гарчиг',
      render: (e: Exercise) => (
        <span className="flex items-center gap-2">
          <span className="font-medium">{e.title}</span>
          <HiddenBadge published={e.isPublished} />
          {/* Санд «шилжүүлсэн» хуучин мөрүүд ур чадварынхаа ангиллыг
              хадгалсаар байгаа тул аль табаас ирснийг нь хэлнэ. Шинээр
              үүсгэсэн нь `assignment` тул юу ч гарахгүй. «Даалгаврын сан»
              гэсэн шошго байсныг хассан: энэ табын мөр бүр сангийнх. */}
          {bank && e.category && e.category !== BANK_CAT && (
            <Badge color="gray">
              {CATS.find((c) => c.key === e.category)?.label ?? e.category}
            </Badge>
          )}
          {/* Үр дагаврыг нь хэлнэ, оноштой нь биш: «хариулах боломжгүй» гэдэг
              нь юу болсныг хэлэх боловч тэр мөр аппад ОГТ харагдахгүй байгааг
              хэлдэггүй — админ нийтэлсэн мөрөө хараад бүх юм хэвийн гэж боддог. */}
          {quality.has(e.id) && (
            <Badge color={quality.get(e.id)!.blocked ? 'red' : 'yellow'}>
              {quality.get(e.id)!.blocked ? 'Аппад харагдахгүй' : 'Шалгах'}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: 'topic', header: 'Сэдэв',
      render: (e: Exercise) =>
        e.topic ? <Badge color="yellow">{e.topic}</Badge> : <span className="text-gray-300">—</span>,
    },
    { key: 'level', header: 'Түвшин', render: (e: Exercise) => <Badge color="gray">{e.level.toUpperCase()}</Badge> },
    { key: 'qs', header: 'Асуулт', render: (e: Exercise) => <span className="text-gray-600">{e.questions?.length ?? 0}</span> },
    { key: 'xp', header: 'XP', render: (e: Exercise) => <span className="text-primary font-medium">⚡ {e.xpReward}</span> },
    {
      key: 'actions', header: '',
      render: (e: Exercise) => (
        <div className="flex gap-1 justify-end">
          <VisibilityButton published={e.isPublished} onToggle={() => togglePublish(e)} />
          <RowActions onEdit={() => openEdit(e)} onDelete={() => remove(e.id)} />
        </div>
      ),
      className: 'text-right',
    },
  ];

  const speaking = cat === 'speaking';
  const reading = cat === 'reading';

  return (
    <>
      <PageHeader
        title="Дасгал"
        description="Хичээлээс тусдаа, бие даасан дасгалууд (4 төрөл)"
        action={!speaking && !reading && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Импорт</Button>
            <Button variant="secondary" onClick={() => { setAiBrief(''); setAiOpen(true); }}><Sparkles className="h-4 w-4" /> AI-аар үүсгэх</Button>
            <BulkGenerateButton onClick={() => setBulkOpen(true)} />
            <Button onClick={openCreate}><Plus className="h-4 w-4" /> Дасгал нэмэх</Button>
          </div>
        )}
      />

      {aiOpen && (
        <AiBulkGenerator
          target={{
            kind: 'exercise',
            label: CATS.find((c) => c.key === cat)?.label ?? 'Дасгал',
            category: cat,
            topicOptions: exerciseCategoryOptions(cat),
            xpReward: 50,
            // Санд үүсгэсэн дасгал сурагчид ил гарвал бүх утга нь алдагдана.
            ...(bank ? { save: { assignOnly: true } } : {}),
          }}
          initialBrief={aiBrief}
          onClose={() => setAiOpen(false)}
          onSaved={load}
        />
      )}

      {bulkOpen && (
        <BulkGenerateModal
          kind="exercise"
          title="Дасгал"
          targets={BULK_TARGETS}
          defaultXp={50}
          onClose={() => setBulkOpen(false)}
          onStarted={setBulkJobId}
        />
      )}

      {/* Category tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CATS.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCat(c.key); setPage(1); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${cat === c.key ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Сан гэдэг нь юу болохыг нэг л удаа, тухайн таб дээр байхад хэлнэ. */}
      {bank && (
        <p className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          <b>Зөвхөн багш хардаг сан.</b> Сурагч эдгээрийг Дасгал/Сорил табаасаа
          ОГТ олохгүй — багш ангидаа даалгавар болгож өгсний дараа л нээгдэнэ.
          Багш нэг тестээс дурын хэдэн асуултыг (ж: 15-аас 5) сонгож өгч чадна,
          тиймээс энд <b>сэдэв</b> (Present Simple, Modal verbs…) нь хамгийн
          чухал талбар.
        </p>
      )}

      {bulkJobId && (
        <BulkGenerateProgress
          jobId={bulkJobId}
          onRefresh={load}
          onClose={() => setBulkJobId(null)}
        />
      )}

      {/* Хуучин ноорог мөр үлдсэн бол ил гаргана (шинэ хадгалалт үргэлж нийтлэгддэг). */}
      {!speaking && !reading && (
        <UnpublishedBanner
          count={hidden.length}
          onPublishAll={publishAllHidden}
          busy={publishingAll}
          noun="дасгал"
        />
      )}

      {/*
        Чанарын тайлан. Сервер «хариулах боломжгүй» дасгалыг аппаас аль хэдийн
        нуусан — энд шалтгаан бүрийг нь нэрлэж, засах мөр рүү нь шууд хүргэнэ.
      */}
      {(broken.length > 0 || suspect.length > 0) && (
        <QualityPanel
          broken={broken}
          suspect={suspect}
          quality={quality}
          onEdit={openEdit}
        />
      )}

      {/* Bulk action bar */}
      {!speaking && !reading && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">{selected.size} сонгосон:</span>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(true)}>Нийтлэх</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkPublish(false)}>Аппаас нуух</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkSetBank(true)}>Даалгаврын сан руу</Button>
          <Button variant="secondary" size="sm" onClick={() => bulkSetBank(false)}>Сурагчид нээх</Button>
          <Button variant="danger" size="sm" onClick={bulkDelete}><Trash2 className="h-4 w-4" /> Устгах</Button>
        </div>
      )}

      {speaking ? (
        <SpeakingPanel />
      ) : reading ? (
        <ReadingPage embedded />
      ) : (
        <>
          <Table columns={columns} rows={paged} keyFn={(e) => e.id} empty="Дасгал байхгүй" />
          <Pagination page={page} total={total} limit={LIMIT} onPage={setPage} />
        </>
      )}

      {(modal === 'create' || modal === 'edit') && (
        <Modal title={modal === 'create' ? 'Дасгал нэмэх' : 'Дасгал засах'} onClose={() => setModal(null)} size="2xl">
          <div className="space-y-4">
            <Input label="Гарчиг" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <TopicField
              listId="exercise-topics"
              options={exerciseCategoryOptions(cat)}
              value={form.topic}
              onChange={(topic) => setForm({ ...form, topic })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Select label="Түвшин" options={LEVEL_OPTIONS} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} />
              <Select label="Асуултын төрөл" options={QTYPE_OPTIONS} value={form.questionType} onChange={(e) => changeType(e.target.value as QuestionType)} />
              <Input label="XP шагнал" type="number" min={0} value={form.xpReward} onChange={(e) => setForm({ ...form, xpReward: Number(e.target.value) })} />
            </div>

            {/* Сонсголын дасгалын цөм: апп ЭНЭ бичвэрийг дуугаар уншиж, сурагч
                хариулах хүртэл нуудаг. ЗААВАЛ бөглөнө — хоосон бол асуултууд
                эх мэдээлэлгүй үлдэж, сурагч таамаглахаас өөр аргагүй болно. */}
            {cat === 'listening' && (
              <Input
                label="Аудио URL (сонголтоор)"
                value={form.audioUrl}
                onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
                placeholder="https://.../listening.mp3"
              />
            )}
            {cat === 'listening' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Сонсох яриа{' '}
                  {form.audioUrl.trim() ? (
                    <span className="text-gray-400">(бичлэгтэй тул сонголтоор)</span>
                  ) : (
                    <>
                      <span className="text-red-500">*</span>{' '}
                      <span className="text-gray-400">(апп үүнийг дуугаар уншина)</span>
                    </>
                  )}
                </label>
                <textarea
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  rows={5}
                  placeholder={'Sarah: Hi Tom, how are you?\nTom: I am good, thanks.'}
                  value={form.passageText}
                  onChange={(e) => setForm({ ...form, passageText: e.target.value })}
                />
                <p className="text-xs text-gray-400">
                  Сурагч үүнийг зөвхөн сонсоно — хариулсны дараа бичвэр нь харагдана.
                  <b className="text-gray-500"> Асуулт бүрийн хариулт энэ яриан дотор
                  байх ёстой</b> — эс бөгөөс сурагч таамаглана.
                </p>
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Асуултууд ({form.questions.length})</label>
              <QuizQuestionsEditor
                questionType={form.questionType}
                questions={form.questions}
                onChange={(questions) => setForm({ ...form, questions })}
              />
            </div>

            <p className="text-xs text-gray-500">
              {bank
                ? '📋 Даалгаврын санд хадгална — сурагч өөрөө олохгүй, зөвхөн багш өгсний дараа нээгдэнэ.'
                : '✅ Хадгалмагц шууд нийтлэгдэж, апп дээр гарна.'}
            </p>
            <ErrorBox message={error} />
            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving} />
          </div>
        </Modal>
      )}

      {/* Импорт — дундын цонх (`components/ImportModal.tsx`). Excel/Word/CSV
          бүгд нэг замаар уншигдана, формат нь тэнд нэг л газар бичигдсэн. */}
      {importOpen && (
        <ImportModal
          title={`Дасгал импорт (${CATS.find((c) => c.key === cat)?.label})`}
          questionType={impType}
          multiPack={impMultiPack}
          onMultiPack={setImpMultiPack}
          onClose={() => setImportOpen(false)}
          onAi={(text) => { setAiBrief(text); setImportOpen(false); setAiOpen(true); }}
          note={
            bank
              ? '📋 Даалгаврын санд орно — сурагч өөрөө олохгүй, зөвхөн багш өгсний дараа нээгдэнэ.'
              : '✅ Импортолсон дасгал шууд нийтлэгдэж, апп дээр гарна.'
          }
          fields={
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Гарчиг" value={impTitle} onChange={(e) => setImpTitle(e.target.value)} />
                <TopicField
                  listId="exercise-import-topics"
                  options={exerciseCategoryOptions(cat)}
                  value={impTopic}
                  onChange={setImpTopic}
                />
                <Select label="Түвшин" options={LEVEL_OPTIONS} value={impLevel} onChange={(e) => setImpLevel(e.target.value)} />
                <Select
                  label="Асуултын төрөл"
                  options={[{ value: 'multiple_choice', label: 'Олон сонголт' }, { value: 'fill_blank', label: 'Нөхөх' }]}
                  value={impType}
                  onChange={(e) => setImpType(e.target.value as QuestionType)}
                />
              </div>
              {/* Импортоор ч сонсголын дасгал ЯРИАГҮЙ орж болохгүй — эс бөгөөс
                  асуултууд эх мэдээлэлгүй үлдэнэ (сервер ч татгалзана). */}
              {cat === 'listening' && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">
                    Сонсох яриа <span className="text-red-500">*</span>{' '}
                    <span className="text-gray-400">(бүх асуултад нэг яриа)</span>
                  </label>
                  <textarea
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    rows={4}
                    placeholder={'Sarah: Hi Tom, how are you?\nTom: I am good, thanks.'}
                    value={impScript}
                    onChange={(e) => setImpScript(e.target.value)}
                  />
                </div>
              )}
            </>
          }
          onImport={runImport}
        />
      )}
    </>
  );
}
