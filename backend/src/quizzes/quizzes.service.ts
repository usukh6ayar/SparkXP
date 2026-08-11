import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { Quiz } from '../entities/quiz.entity';
import { runGeminiText } from '../dictionary/gemini-text';
import {
  buildPrompt,
  buildSchema,
  buildTypePrompt,
  clampCount,
  LISTENING_CATEGORY,
  maxTokensFor,
  MIN_LISTENING_SCRIPT,
  parseDraft,
  parseTypePick,
  TYPE_PICK_SCHEMA,
  type GeneratedDraft,
  type GenerateOptions,
  type GenQuestionType,
} from './ai-generate';
import {
  buildStepBrief,
  buildWordBank,
  normalizeChoices,
  dedupKey,
  planSteps,
  questionText,
  recipeFor,
  stepName,
  MAX_TOTAL_STEPS,
  type BulkGenerateReport,
  type BulkStep,
} from './bulk-generate';
import {
  blockingIssues,
  checkQuiz,
  describeIssues,
  type QualityIssue,
  type QuizLike,
} from './quality';
import { AiGenerateQuizDto } from './dto/ai-generate-quiz.dto';
import { BulkGenerateQuizDto } from './dto/bulk-generate-quiz.dto';
import { CreateQuizDto, QuestionDto } from './dto/create-quiz.dto';
import { UpdateQuizDto } from './dto/update-quiz.dto';
import { QueryQuizzesDto } from './dto/query-quizzes.dto';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

/** Shape we accept and store for a multiple-choice question. */
interface McQuestion {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correct: number;
  points: number;
  imageUrl?: string; // IELTS: picture / Writing-Task-1 chart (optional)
}

/** Shape we accept and store for a fill-in-the-blank question. */
interface FbQuestion {
  type: 'fill_blank';
  question: string;
  answer: string;
  /** Дарж сонгох 4 сонголт (зөв хариулт багтсан). Байхгүй бол апп бичүүлнэ. */
  choices?: string[];
  points: number;
}

/** Shape we accept and store for a word-matching question. */
interface WmQuestion {
  type: 'word_match';
  pairs: { left: string; right: string }[];
  points: number;
}

/** Open written/spoken response (IELTS Writing/Speaking) — self-study, not graded. */
interface OrQuestion {
  type: 'open_response';
  prompt: string;
  modelAnswer: string;
  imageUrl?: string; // Writing Task 1 chart/graph
  bandNote?: string; // band descriptor / guidance
  points: 0;
}

type StoredQuestion = McQuestion | FbQuestion | WmQuestion | OrQuestion;

export interface QuizResult {
  score: number; // correct points earned
  total: number; // max possible points
  percentage: number; // 0–100
  passed: boolean; // >= 50%
  xpEarned: number;
  breakdown: { questionIndex: number; correct: boolean; points: number }[];
  /** Approximate IELTS band (0–9) — set only for ielts_listening/reading. */
  band?: number;
}

/** Per-question instant feedback (C2). Reveals the correct answer ONLY when the
 *  user was wrong, and only for that single question — never the whole quiz. */
export interface CheckAnswerResult {
  correct: boolean;
  correctAnswer?: number | string | { left: string; right: string }[];
}

export interface PaginatedQuizzes {
  items: Quiz[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Давхардлаас хамгаалах "банк" — нэг ангиллын одоо байгаа бүх асуултын түлхүүр
 * + гарчиг. Гүйлтийн явцад шинээр үүссэн зүйл ч энд нэмэгдэнэ.
 */
interface CategoryBank {
  keys: Set<string>;
  titles: string[];
}

/** Зэрэг явуулах AI дуудлагын тоо. Gemini-гийн хурдны хязгаарт эвтэй утга. */
const BULK_CONCURRENCY = 3;
/** Давхардлыг хассаны дараа энэ тооноос цөөн асуулт үлдвэл дасгалыг хаяна. */
const MIN_QUESTIONS_KEPT = 3;
/** Давхардал шалгахад ачаалах хамгийн олон мөр (нэг ангилалд). */
const EXISTING_SCAN_LIMIT = 500;
/** Чанарын тайланд нэг удаад шалгах хамгийн олон мөр. */
const QUALITY_SCAN_LIMIT = 2000;

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  /**
   * "Бүх төрлөөр үүсгэх" background ажлуудын явц, jobId-гаар. Санах ойд
   * (нэг instance) — Үгс/Хэлц хуудасны загвартай ижил, MVP-д хангалттай.
   */
  private readonly bulkJobs = new Map<string, BulkGenerateReport>();

  constructor(
    @InjectRepository(Quiz)
    private readonly quizzes: Repository<Quiz>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Админы бичсэн агуулгаас асуултын ноорог үүсгэнэ (Дасгал · Quiz · IELTS
   * гурвуулаа нэг зам — ялгаа нь зөвхөн prompt-ийн контекст).
   *
   * ⚠️ Энэ метод DB рүү юу ч бичихгүй: буцаасан ноорогийг админ preview дээр
   * хараад, засаад, `POST /quizzes`-ээр өөрөө хадгална. Буруу хариулт шууд
   * сурагч руу хүрэхээс сэргийлсэн санаатай шийдэл.
   */
  async aiGenerate(dto: AiGenerateQuizDto): Promise<GeneratedDraft> {
    const options: GenerateOptions = { ...dto, count: clampCount(dto.count) };
    // Форматыг ангиллын жор мэднэ (Сонсгол · Дүрэм · Нөхөх · Бичих). Жор нь
    // админы сонголтоос ч, AI-гийн таамгаас ч ДЭЭГҮҮР: формат буруу байвал
    // дасгал хариулах боломжгүй болдог (ж: сонсгол `open_response` болчихвол
    // аппын runner түүнийг харуулж ч чадахгүй). Bulk зам аль хэдийн ингэдэг —
    // энэ зам орхигдсоноос болж админы үүсгэсэн дасгал эвдэрдэг байв.
    // Дараалал: админы ЗААСАН төрөл → ангиллын жор → AI-гийн таамаг.
    // ⚠️ Жорыг админаас дээгүүр тавибал сонсголд «Нөхөх» сонгох боломжгүй
    // болно (жор нь үргэлж эхний хэлбэрээ буцаана).
    const type =
      options.questionType ??
      (dto.category ? recipeFor(dto.category)?.questionType : undefined) ??
      (await this.pickQuestionType(options));
    options.questionType = type;

    const { text } = await runGeminiText(
      this.config,
      buildPrompt(options),
      `quiz-generate:${dto.kind}`,
      {
        json: true,
        schema: buildSchema(options, type),
        // Бүтэцтэй гаралтад бага temperature илүү сахилгатай.
        temperature: 0.4,
        // ⚠️ thinking-ийг УНТРААНА. 2.5-flash дээр анхдагчаар асаалттай бөгөөд
        // JSON горимд бодлоо талбар дотор бичиж, хариуг эвдэж, 10+ дахин
        // уртасгаж байсан (5 асуултад 19,550 токен / 76 секунд).
        thinkingBudget: 0,
        maxOutputTokens: maxTokensFor(options.count ?? 10),
      },
    );
    let draft: GeneratedDraft;
    try {
      draft = parseDraft(text, options);
    } catch (e) {
      // parseDraft-ийн алдаанууд нь админд шууд харуулах монгол мессежүүд.
      throw new BadRequestException(
        e instanceof Error ? e.message : 'AI-гийн хариуг боловсруулж чадсангүй',
      );
    }

    // ⚠️ Чанарын шалгуур. AI дүрмийг уншсан ч заримдаа хариулах боломжгүй
    // асуулт бичдэг (хоёрдмол цоорхой, gerund↔infinitive хос г.м.). Ийм
    // ноорогийг админд өгвөл тэр нь шууд Хадгалах дараад аппад гарна —
    // тиймээс эх үүсвэрт нь зогсоож, дахин оролдохыг хэлнэ.
    const issues = checkQuiz({
      ...options,
      questions: draft.questions,
      passageText: draft.passageText,
    });
    const blocking = blockingIssues(issues);
    if (blocking.length > 0) {
      throw new BadRequestException(
        `AI хариулах боломжгүй дасгал үүсгэлээ. ${describeIssues(blocking)} Дахин оролдоно уу.`,
      );
    }
    // Магадгүй эвдэрсэн зүйлсийг **хаяхгүй**, админд анхааруулга болгож үзүүлнэ
    // (шийдэх нь хүний ажил — жинхэнэ алдаа ч, худал дуулга ч байж болно).
    draft.warnings.push(
      ...issues.map((i) =>
        i.questionNo ? `${i.questionNo}-р асуулт: ${i.message}` : i.message,
      ),
    );
    return draft;
  }

  // ── "Бүх төрлөөр үүсгэх" (bulk) ──────────────────────────────────────────

  /**
   * Агуулга бичихгүйгээр бүхэл түвшний контент үүсгэх ажлыг эхлүүлнэ.
   *
   * `aiGenerate`-аас ялгаатай нь энэ нь **DB рүү шууд бичнэ** — 40 дасгалыг
   * preview дээр нэг бүрчлэн шалгах боломжгүй. Оронд нь хамгаалалт нь: асуулт
   * бүр `ai-generate.ts`-ийн чанарын шалгуурыг дамжина, давхардсан асуулт
   * хаягдана, мөн бүх мөр админд жагсаалтад харагдаад засагдах/устгагдах
   * боломжтой хэвээр.
   *
   * Урт ажил (40 дасгал ≈ 3 мин) тул background-д явж, `jobId` буцаана.
   */
  startBulkGenerate(dto: BulkGenerateQuizDto): {
    jobId: string;
    total: number;
  } {
    const steps = planSteps(dto.targets, dto.perTarget);
    if (steps.length > MAX_TOTAL_STEPS) {
      throw new BadRequestException(
        `Нэг удаад хамгийн ихдээ ${MAX_TOTAL_STEPS} дасгал үүсгэнэ ` +
          `(та ${steps.length} хүссэн). Төрөл эсвэл тоогоо багасгана уу.`,
      );
    }

    const jobId = randomUUID();
    const report: BulkGenerateReport = {
      total: steps.length,
      processed: 0,
      created: 0,
      skipped: 0,
      failed: [],
      done: false,
    };
    this.bulkJobs.set(jobId, report);

    void this.runBulkGenerate(dto, steps, report)
      .catch((e: unknown) =>
        this.logger.error(
          `[bulk-generate] job ${jobId} crashed: ${e instanceof Error ? e.message : String(e)}`,
        ),
      )
      .finally(() => {
        report.done = true;
        report.current = undefined;
        // Дууссан үр дүнг админ уншиж амжтал барьж байгаад чөлөөлнө.
        setTimeout(() => this.bulkJobs.delete(jobId), 5 * 60_000);
      });

    return { jobId, total: steps.length };
  }

  /** Явцыг татах (админ 2.5 секунд тутам дуудна). */
  getBulkJob(jobId: string): BulkGenerateReport | undefined {
    return this.bulkJobs.get(jobId);
  }

  /**
   * "Зогсоох" — ажиллаж буй дуудлагууд дуусаад шинэ нь эхлэхгүй.
   * Танихгүй id (дууссан/хугацаа нь дууссан) бол `false`.
   */
  cancelBulkJob(jobId: string): boolean {
    const job = this.bulkJobs.get(jobId);
    if (!job) return false;
    job.canceled = true;
    this.logger.log(`[bulk-generate] cancel requested for job ${jobId}`);
    return true;
  }

  /**
   * Тухайн ангилалд одоо байгаа бүх асуулт + гарчгийг цуглуулна.
   *
   * Хоёр зорилготой: (1) гарчгуудыг prompt-д өгч AI-г давтахаас нь сэргийлэх,
   * (2) буцаж ирсэн асуултаас давхардсаныг нь хасах. Түвшнээр шүүхгүй —
   * A1-д байгаа асуултыг B1-д дахин гаргах нь мөн л давхардал.
   */
  private async loadCategoryBank(category: string): Promise<CategoryBank> {
    const rows = await this.quizzes.find({
      where: { category },
      order: { createdAt: 'DESC' },
      take: EXISTING_SCAN_LIMIT,
    });
    const bank: CategoryBank = { keys: new Set(), titles: [] };
    for (const row of rows) {
      bank.titles.push(row.title);
      for (const q of row.questions ?? []) {
        const key = dedupKey(questionText(q));
        if (key) bank.keys.add(key);
      }
    }
    return bank;
  }

  /** Нэг алхам = нэг дасгал: AI-аар үүсгэх → давхардал хасах → хадгалах. */
  private async runStep(
    step: BulkStep,
    dto: BulkGenerateQuizDto,
    bank: CategoryBank,
    report: BulkGenerateReport,
  ): Promise<void> {
    report.current = stepName(step);
    try {
      const draft = await this.aiGenerate({
        brief: buildStepBrief(step, bank.titles),
        kind: dto.kind,
        category: step.category,
        topic: step.topic ?? undefined,
        level: dto.level,
        questionType: step.questionType as AiGenerateQuizDto['questionType'],
        count: dto.questionCount,
        contextNote: step.contextNote,
      });

      // Аль хэдийн байгаа (эсвэл энэ гүйлтэд дөнгөж үүссэн) асуултыг хасна.
      // Түлхүүрийг хадгалахаас ӨМНӨ нэмнэ — зэрэг явж буй алхам мөн үүнийг харна.
      const fresh = draft.questions.filter((q) => {
        const key = dedupKey(questionText(q));
        if (!key || bank.keys.has(key)) return false;
        bank.keys.add(key);
        return true;
      });

      const minKept = Math.min(MIN_QUESTIONS_KEPT, dto.questionCount);
      if (fresh.length < minKept) {
        report.skipped++;
        return;
      }

      await this.create({
        title: draft.title,
        level: dto.level,
        category: step.category,
        topic: step.topic ?? undefined,
        quizType: step.quizType ?? draft.questionType,
        questions: fresh as CreateQuizDto['questions'],
        xpReward: dto.xpReward ?? 50,
        passageText: draft.passageText ?? undefined,
        // Хадгалах = шууд нийтлэх (админд "ноорог" төлөв байхгүй).
        isPublished: true,
      });
      bank.titles.push(draft.title);
      report.created++;
    } catch (e: unknown) {
      report.failed.push({
        key: stepName(step),
        message: e instanceof Error ? e.message : 'Тодорхойгүй алдаа',
      });
    } finally {
      report.processed++;
    }
  }

  /** Төлөвлөсөн алхмуудыг хязгаарлагдмал зэрэгцээгээр гүйцэтгэнэ. */
  private async runBulkGenerate(
    dto: BulkGenerateQuizDto,
    steps: BulkStep[],
    report: BulkGenerateReport,
  ): Promise<void> {
    // Ангилал тус бүрийн давхардлын банкийг нэг л удаа ачаална.
    const banks = new Map<string, CategoryBank>();
    for (const target of dto.targets) {
      if (!banks.has(target.category)) {
        banks.set(
          target.category,
          await this.loadCategoryBank(target.category),
        );
      }
    }

    let cursor = 0;
    const worker = async (): Promise<void> => {
      while (cursor < steps.length && !report.canceled) {
        const step = steps[cursor++];
        await this.runStep(step, dto, banks.get(step.category)!, report);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(BULK_CONCURRENCY, steps.length) }, worker),
    );
  }

  /**
   * Агуулгад хамгийн тохирох асуултын форматыг AI-аар сонгуулна.
   * Бүтэлгүйтвэл хамгийн түгээмэл формат руу буцна — энэ жижиг алхмаас болж
   * бүхэл онцлог унах ёсгүй.
   */
  private async pickQuestionType(o: GenerateOptions): Promise<GenQuestionType> {
    try {
      const { text } = await runGeminiText(
        this.config,
        buildTypePrompt(o),
        'quiz-generate:type',
        {
          json: true,
          schema: TYPE_PICK_SCHEMA,
          temperature: 0.2,
          thinkingBudget: 0,
          maxOutputTokens: 60,
        },
      );
      return parseTypePick(text) ?? 'multiple_choice';
    } catch {
      return 'multiple_choice';
    }
  }

  /** Validate that every question has a supported type and required fields. */
  private validateQuestions(raw: QuestionDto[]): StoredQuestion[] {
    return raw.map((q, i) => {
      if (q.type === 'multiple_choice') {
        const mc = q as Partial<McQuestion>;
        if (
          typeof mc.question !== 'string' ||
          !Array.isArray(mc.options) ||
          mc.options.length < 2 ||
          typeof mc.correct !== 'number' ||
          mc.correct < 0 ||
          mc.correct >= mc.options.length ||
          typeof mc.points !== 'number' ||
          mc.points < 1
        ) {
          throw new BadRequestException(
            `questions[${i}]: multiple_choice requires question, options (≥2), correct index, points (≥1)`,
          );
        }
        return {
          type: 'multiple_choice' as const,
          question: mc.question,
          options: mc.options as string[],
          correct: mc.correct,
          points: mc.points,
          ...(typeof mc.imageUrl === 'string' ? { imageUrl: mc.imageUrl } : {}),
        };
      }

      if (q.type === 'fill_blank') {
        const fb = q as Partial<FbQuestion>;
        if (
          typeof fb.question !== 'string' ||
          typeof fb.answer !== 'string' ||
          !fb.answer.trim() ||
          typeof fb.points !== 'number' ||
          fb.points < 1
        ) {
          throw new BadRequestException(
            `questions[${i}]: fill_blank requires question, answer, points (≥1)`,
          );
        }
        // Сонголт байвал зөв хариулт нь ЗААВАЛ дотор нь байх ёстой — эс бөгөөс
        // сурагч дөрвөн буруу хувилбараас сонгох болно.
        const choices = normalizeChoices(fb.choices, fb.answer);
        return {
          type: 'fill_blank' as const,
          question: fb.question,
          answer: fb.answer,
          ...(choices ? { choices } : {}),
          points: fb.points,
        };
      }

      if (q.type === 'word_match') {
        const wm = q as Partial<WmQuestion>;
        if (
          !Array.isArray(wm.pairs) ||
          wm.pairs.length < 2 ||
          typeof wm.points !== 'number' ||
          wm.points < 1
        ) {
          throw new BadRequestException(
            `questions[${i}]: word_match requires pairs (≥2 pairs) and points (≥1)`,
          );
        }
        return {
          type: 'word_match' as const,
          pairs: wm.pairs as { left: string; right: string }[],
          points: wm.points,
        };
      }

      // After the three branches above return, q narrows to OpenResponseQuestionDto.
      if (q.type === 'open_response') {
        const or = q as Partial<OrQuestion>;
        if (
          typeof or.prompt !== 'string' ||
          !or.prompt.trim() ||
          typeof or.modelAnswer !== 'string'
        ) {
          throw new BadRequestException(
            `questions[${i}]: open_response requires prompt and modelAnswer`,
          );
        }
        return {
          type: 'open_response' as const,
          prompt: or.prompt,
          modelAnswer: or.modelAnswer,
          points: 0 as const,
          ...(typeof or.imageUrl === 'string' ? { imageUrl: or.imageUrl } : {}),
          ...(typeof or.bandNote === 'string' ? { bandNote: or.bandNote } : {}),
        };
      }

      throw new BadRequestException(
        `questions[${i}]: unknown type "${String((q as { type?: unknown }).type)}" — use multiple_choice, fill_blank, word_match, or open_response`,
      );
    });
  }

  /**
   * Сонсголын дасгал хариулах боломжтой эсэхийг шалгана.
   *
   * Сонсох зүйлгүй сонсголын дасгал бол сурагчид эх мэдээлэл өгөлгүй асуулт
   * асуусан хэрэг — таамаглахаас өөр арга үлдэхгүй. Бодит жишээ: "Өдөр тутмын
   * ярианы сонсгол" гэсэн дасгал шууд "What time does Sarah usually wake up?"
   * гэж асууж, Сара хэдэд босдог тухай хаана ч дурдаагүй байв.
   *
   * Бүх дүрэм `quality.ts`-д — үүсгэх · хадгалах · тайлагнах гурвуулан ижил
   * шалгуур ашиглана (DRY). Тиймээс ийм мөр DB рүү огт орохгүй.
   */
  private assertAnswerable(quiz: QuizLike): void {
    const blocking = blockingIssues(checkQuiz(quiz));
    if (blocking.length === 0) return;

    throw new BadRequestException(
      `Дасгал хариулах боломжгүй байна. ${describeIssues(blocking)}`,
    );
  }

  create(dto: CreateQuizDto): Promise<Quiz> {
    const validatedQuestions = this.validateQuestions(dto.questions);
    this.assertAnswerable({ ...dto, questions: validatedQuestions });
    const quiz = this.quizzes.create({ ...dto, questions: validatedQuestions });
    return this.quizzes.save(quiz);
  }

  async findAll(query: QueryQuizzesDto): Promise<PaginatedQuizzes> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.quizzes.createQueryBuilder('q');
    if (query.level) qb.andWhere('q.level = :level', { level: query.level });
    if (query.isPublished !== undefined) {
      qb.andWhere('q.isPublished = :isPublished', {
        isPublished: query.isPublished,
      });
    }
    if (query.lessonId)
      qb.andWhere('q.lessonId = :lessonId', { lessonId: query.lessonId });
    if (query.category)
      qb.andWhere('q.category = :category', { category: query.category });
    if (query.topic) qb.andWhere('q.topic = :topic', { topic: query.topic });
    // Standalone "Дасгал" = quizzes not attached to any lesson.
    if (query.standalone) qb.andWhere('q.lessonId IS NULL');

    // ⚠️ Сонсох яриагүй сонсголын дасгалыг SQL түвшинд шууд хасна — энэ нь
    // хамгийн олон тохиолддог эвдрэл бөгөөд хуудаслалтыг зөв байлгана.
    if (!query.includeUnanswerable) {
      qb.andWhere(
        `NOT (q.category = :listening
              AND q.audioUrl IS NULL
              AND COALESCE(LENGTH(TRIM(q.passageText)), 0) < :minScript)`,
        { listening: LISTENING_CATEGORY, minScript: MIN_LISTENING_SCRIPT },
      );
    }

    const [items, total] = await qb
      .orderBy('q.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // ⚠️ Үлдсэн эвдрэлүүд (хоёрдмол хариулт, gerund↔infinitive хос, зөв хариулт
    // сонголтод байхгүй г.м.) нь асуултын jsonb дотор байдаг тул SQL-ээр
    // шүүхэд хэцүү — эдгээрийг JS-ээр хасна. Шинэ контент хадгалалт дээр аль
    // хэдийн блоклогддог тул энэ нь зөвхөн **хуучин мөрүүдийн** цэвэрлэгээ.
    // Серверт хийсэн тул апп шинэчлэхгүйгээр шууд үйлчилнэ.
    if (query.includeUnanswerable) return { items, total, page, limit };

    const clean = items.filter(
      (q) => blockingIssues(checkQuiz(q)).length === 0,
    );
    // `total` нь энэ хуудсанд хасагдсаныг л тооцно (бүх хуудсыг уншихгүйгээр
    // яг таг тоог мэдэх боломжгүй). Апп 100-гийн хязгаартай нэг хуудсаар
    // татдаг тул практикт яг таарна.
    return {
      items: clean,
      total: total - (items.length - clean.length),
      page,
      limit,
    };
  }

  /**
   * Админы **чанарын тайлан** — хариулах боломжгүй (`block`) ба эргэлзээтэй
   * (`warn`) бүх дасгалыг олж жагсаана.
   *
   * Яагаад хэрэгтэй вэ: шинэ контент хадгалалт дээр блоклогддог болсон ч
   * **хуучин мөрүүд DB-д үлдсэн**. Тэдгээрийг гараар хайх боломжгүй тул
   * админд "юуг засах вэ" гэсэн бэлэн жагсаалт өгнө.
   */
  async qualityReport(category?: string): Promise<{
    items: {
      id: string;
      title: string;
      category: string | null;
      topic: string | null;
      isPublished: boolean;
      /** `true` = апп дээр огт харагдахгүй (хариулах боломжгүй). */
      blocked: boolean;
      issues: QualityIssue[];
    }[];
    total: number;
    blocked: number;
  }> {
    const rows = await this.quizzes.find({
      where: category ? { category } : {},
      order: { createdAt: 'DESC' },
      take: QUALITY_SCAN_LIMIT,
    });

    const items = rows
      .map((q) => ({ quiz: q, issues: checkQuiz(q) }))
      .filter((r) => r.issues.length > 0)
      .map(({ quiz, issues }) => ({
        id: quiz.id,
        title: quiz.title,
        category: quiz.category,
        topic: quiz.topic,
        isPublished: quiz.isPublished,
        blocked: blockingIssues(issues).length > 0,
        issues,
      }));

    return {
      items,
      total: items.length,
      blocked: items.filter((i) => i.blocked).length,
    };
  }

  async findOne(id: string): Promise<Quiz & { wordBank?: string[] }> {
    const quiz = await this.quizzes.findOne({ where: { id } });
    if (!quiz) throw new NotFoundException('Quiz олдсонгүй');
    const wordBank = buildWordBank(quiz.questions);
    return wordBank ? Object.assign(quiz, { wordBank }) : quiz;
  }

  async update(id: string, dto: UpdateQuizDto): Promise<Quiz> {
    const quiz = await this.findOne(id);
    if (dto.questions) {
      const validated = this.validateQuestions(dto.questions);
      Object.assign(quiz, { ...dto, questions: validated });
    } else {
      Object.assign(quiz, dto);
    }
    // Нэгтгэсний ДАРАА шалгана: админ энэ хадгалалтаар яриаг нь цэвэрлэсэн ч,
    // эсвэл ангиллыг нь сонсгол болгож сольсон ч аль ч тохиолдолд баригдана.
    this.assertAnswerable(quiz);
    return this.quizzes.save(quiz);
  }

  async remove(id: string): Promise<void> {
    const quiz = await this.findOne(id);
    await this.quizzes.remove(quiz);
  }

  /**
   * Score a submission.
   * - Answers are matched by questionIndex.
   * - Anti-abuse: at least one answer required; XP is proportional to correct points.
   * - Returns the scoring result; actual XP award is done by the caller (XpService).
   */
  scoreSubmission(quiz: Quiz, dto: SubmitQuizDto): QuizResult {
    if (!dto.answers.length) {
      throw new BadRequestException('Хариулт илгээгдээгүй байна');
    }

    const questions = quiz.questions as StoredQuestion[];
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);
    if (totalPoints === 0) {
      throw new BadRequestException('Quiz-д оноогүй асуулт байна');
    }

    // Build answer lookup by questionIndex
    const answerMap = new Map<number, number | string>();
    for (const a of dto.answers) {
      answerMap.set(a.questionIndex, a.answer);
    }

    let earned = 0;
    const breakdown = questions.map((q, i) => {
      const correct = this.gradeQuestion(q, answerMap.get(i));
      if (correct) earned += q.points;
      return { questionIndex: i, correct, points: correct ? q.points : 0 };
    });

    const percentage = Math.round((earned / totalPoints) * 100);
    const passed = percentage >= 50;
    // XP is proportional: full xpReward for 100%, scaled linearly, 0 for no correct answers.
    const xpEarned =
      earned > 0 ? Math.floor(quiz.xpReward * (earned / totalPoints)) : 0;

    return {
      score: earned,
      total: totalPoints,
      percentage,
      passed,
      xpEarned,
      breakdown,
    };
  }

  /**
   * Grade ONE answered question against its stored correct answer.
   * Single source of truth for correctness — used by both scoreSubmission
   * (whole quiz) and checkAnswer (per-question instant feedback).
   */
  private gradeQuestion(
    q: StoredQuestion,
    userAnswer: number | string | undefined,
  ): boolean {
    if (q.type === 'multiple_choice') {
      return userAnswer === q.correct;
    }
    if (q.type === 'fill_blank') {
      return (
        typeof userAnswer === 'string' &&
        userAnswer.trim().toLowerCase() === q.answer.trim().toLowerCase()
      );
    }
    if (q.type === 'word_match') {
      // Mobile sends matched pairs as JSON string; full match = correct.
      try {
        const submitted =
          typeof userAnswer === 'string' ? JSON.parse(userAnswer) : userAnswer;
        if (Array.isArray(submitted)) {
          return q.pairs.every((pair) =>
            submitted.some(
              (s: { left: string; right: string }) =>
                s.left === pair.left && s.right === pair.right,
            ),
          );
        }
      } catch {
        return false;
      }
    }
    // open_response (Writing/Speaking) is self-study only → never auto-correct.
    return false;
  }

  /** The correct answer to reveal for a single question (mc → index,
   *  fill_blank → string, word_match → pairs). */
  private correctAnswerOf(
    q: StoredQuestion,
  ): CheckAnswerResult['correctAnswer'] {
    if (q.type === 'multiple_choice') return q.correct;
    if (q.type === 'fill_blank') return q.answer;
    if (q.type === 'word_match') return q.pairs;
    return q.modelAnswer; // open_response — self-study; modelAnswer is a string
  }

  /**
   * C2: check a single answer for instant feedback (no XP, no scoring).
   * Reveals the correct answer only when the user was wrong, and only for
   * that one question — the full answer key is never sent up front.
   */
  checkAnswer(
    quiz: Quiz,
    questionIndex: number,
    answer: number | string,
  ): CheckAnswerResult {
    const questions = quiz.questions as StoredQuestion[];
    const q = questions[questionIndex];
    if (!q) {
      throw new BadRequestException(
        `questionIndex ${questionIndex} нь quiz-д байхгүй`,
      );
    }
    const correct = this.gradeQuestion(q, answer);
    return correct
      ? { correct: true }
      : { correct: false, correctAnswer: this.correctAnswerOf(q) };
  }
}
