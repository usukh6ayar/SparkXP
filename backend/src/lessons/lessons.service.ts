import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { XpService } from '../xp/xp.service';
import { XpSource, ContentLevel, AiUsageType } from '../common/enums';
import { STT_ADAPTER, type SttAdapter } from '../ai-gateway/providers/stt.adapter';
import {
  readVideoUrl,
  readTranscript,
  withTranscript,
  stripTranscript,
  preserveTranscript,
  type LessonTranscript,
} from './lesson-transcript';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';

export interface PaginatedLessons {
  items: Lesson[];
  total: number;
  page: number;
  limit: number;
}

/** The next lesson to do + truthful progress through its level (C1). */
export interface ContinueResult {
  lesson: { id: string; title: string; thumbnailUrl: string | null; type: string; level: string } | null;
  level: string | null;
  levelDone: number;
  levelTotal: number;
  allCompleted: boolean;
}

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(AiUsage)
    private readonly aiUsages: Repository<AiUsage>,
    @Inject(STT_ADAPTER)
    private readonly stt: SttAdapter,
    private readonly xp: XpService,
  ) {}

  /**
   * Mark a lesson complete for a student — awards XP once per lesson (idempotent
   * via XpLog source+referenceId). Re-completing earns nothing.
   */
  async complete(
    userId: string,
    lessonId: string,
  ): Promise<{ lessonId: string; alreadyCompleted: boolean; xpAwarded: number }> {
    const lesson = await this.lessons.findOne({ where: { id: lessonId } });
    if (!lesson) throw new NotFoundException('Хичээл олдсонгүй');

    const { lesson: lessonXp } = await this.xp.rewards();
    const log = await this.xp.awardOnce({
      userId,
      amount: lessonXp,
      source: XpSource.LESSON,
      referenceId: lessonId,
    });
    return { lessonId, alreadyCompleted: log === null, xpAwarded: log ? lessonXp : 0 };
  }

  /**
   * The "Continue learning" target: the first published, top-level lesson the
   * student hasn't completed yet (ordered by CEFR level, then position), plus
   * truthful progress through that lesson's level. All done → lesson null.
   */
  async getContinue(userId: string): Promise<ContinueResult> {
    const published = await this.lessons.find({
      where: { isPublished: true, parentLessonId: IsNull() },
      // Same ordering as findAll() — otherwise "the next lesson" and the order
      // the student sees on the level trail disagree whenever positions tie.
      order: { level: 'ASC', position: 'ASC', createdAt: 'ASC' },
      select: { id: true, title: true, thumbnailUrl: true, type: true, level: true },
    });
    const completed = await this.xp.getCompletedLessonIds(userId);
    const next = published.find((l) => !completed.has(l.id)) ?? null;

    // Progress is measured over the level of the next lesson (or the last level
    // once everything is done), so the hero shows a real "done / total".
    const level = next?.level ?? published[published.length - 1]?.level ?? null;
    const inLevel = published.filter((l) => l.level === level);
    const levelDone = inLevel.filter((l) => completed.has(l.id)).length;

    return {
      lesson: next
        ? { id: next.id, title: next.title, thumbnailUrl: next.thumbnailUrl, type: next.type, level: next.level }
        : null,
      level,
      levelDone,
      levelTotal: inLevel.length,
      allCompleted: next === null && published.length > 0,
    };
  }

  /** Create a lesson. With no explicit `position` the lesson is appended to the
   *  end of its level, so an author who never touches the field still gets a
   *  sane order instead of everything piling up at 0. */
  async create(dto: CreateLessonDto): Promise<Lesson> {
    const lesson = this.lessons.create(dto);
    // Бичвэрийг зөвхөн `/transcribe` бичнэ — үүсгэх үед клиентээс ирсэн
    // `content.transcript`-ыг хаяна (`update()`-тэй ижил дүрэм).
    if (dto.content) lesson.content = stripTranscript(dto.content);
    if (dto.position === undefined) lesson.position = await this.nextPosition(dto);
    return this.lessons.save(lesson);
  }

  /** Last position in this level/track + 1 (1 for the first lesson). */
  private async nextPosition(dto: CreateLessonDto): Promise<number> {
    const last = await this.lessons.findOne({
      where: {
        level: dto.level ?? ContentLevel.A1,
        parentLessonId: dto.parentLessonId ?? IsNull(),
      },
      order: { position: 'DESC' },
      select: { id: true, position: true },
    });
    return (last?.position ?? 0) + 1;
  }

  /** Lesson ids this student has already completed — the level trail marks its
   *  nodes by id, so a checkmark always lands on the lesson that was finished
   *  (counting "the first N nodes" mislabels them when positions tie). */
  async completedIds(userId: string): Promise<{ ids: string[] }> {
    const completed = await this.xp.getCompletedLessonIds(userId);
    return { ids: [...completed] };
  }

  /** List lessons with optional filters and pagination. Default order = level,
   *  then `position` (the same order `getContinue` walks, so the student sees
   *  one consistent sequence); `sort=newest` gives the admin its authoring view. */
  async findAll(query: QueryLessonsDto): Promise<PaginatedLessons> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (query.type) where.type = query.type;
    if (query.level) where.level = query.level;
    if (query.isPublished !== undefined) where.isPublished = query.isPublished;
    // Default list shows only top-level lessons; `parentId` fetches a parent's
    // "deeper" sub-lessons (shown inside the lesson detail screen).
    where.parentLessonId = query.parentId ?? IsNull();

    const [items, total] = await this.lessons.findAndCount({
      where,
      // `position` is only unique inside a level, so `level` has to lead or the
      // list interleaves levels. `newest` is the admin's authoring view.
      order:
        query.sort === 'newest'
          ? { createdAt: 'DESC' }
          : { level: 'ASC', position: 'ASC', createdAt: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Бичвэр нь зохиогчийн материал — сурагчийн апп руу явуулах шалтгаан алга
    // (жагсаалтад 20 хичээл × ~20KB болно).
    return {
      items: items.map((l) => ({ ...l, content: stripTranscript(l.content) })),
      total,
      page,
      limit,
    };
  }

  /**
   * Дотоод хэрэглээний хичээл — бичвэр нь ХЭВЭЭР. Хадгалах гэж байгаа код
   * ЗААВАЛ үүнийг ашиглана: `findOne()`-ийн хассан хувилбарыг `save()` хийвэл
   * бичвэр DB-ээс устана.
   */
  private async findRaw(id: string): Promise<Lesson> {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Хичээл олдсонгүй');
    return lesson;
  }

  /** Гадагш буцаах хичээл — бичвэр хасагдсан ХУВИЛБАР (эх мөр хөндөгдөхгүй). */
  async findOne(id: string): Promise<Lesson> {
    const lesson = await this.findRaw(id);
    return { ...lesson, content: stripTranscript(lesson.content) };
  }

  async update(id: string, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.findRaw(id);
    // Админы форм `content`-оо жагсаалтын хариунаас угсардаг бөгөөд тэнд
    // бичвэр байхгүй → хамгаалахгүй бол хадгалах бүрд устана.
    const content =
      dto.content !== undefined ? preserveTranscript(lesson.content, dto.content) : lesson.content;
    Object.assign(lesson, dto, { content });
    const saved = await this.lessons.save(lesson);
    return { ...saved, content: stripTranscript(saved.content) };
  }

  async remove(id: string): Promise<void> {
    const lesson = await this.findRaw(id);
    await this.lessons.remove(lesson);
  }

  // ── Видеоны бичвэр (транскрипт) ──────────────────────────────────────────

  /** Админд харуулах бичвэр. Хөрвүүлээгүй бол `text` хоосон. */
  async getTranscript(id: string): Promise<LessonTranscript> {
    const lesson = await this.findRaw(id);
    return readTranscript(lesson.content) ?? { text: '', seconds: 0, at: '' };
  }

  /**
   * Видеог Gemini STT-аар бичвэр болгоно.
   *
   * Видео энэ процессоор дамжихгүй — Scribe-д URL өгнө (`transcribeUrl`).
   * Зардлыг `ai_usages`-д АДМИНЫ нэр дээр бичнэ: сурагчийн
   * `plans.sttMinutesLimit` рүү хүрэхгүй (тэр хязгаар buddy-гийн дуудлагын
   * цэг дээр тусдаа шалгагддаг), гэхдээ зардал хаанаас гарсан нь ил үлдэнэ.
   */
  async transcribe(id: string, adminId: string): Promise<LessonTranscript> {
    const lesson = await this.findRaw(id);
    const videoUrl = readVideoUrl(lesson.content);
    if (!videoUrl) {
      throw new BadRequestException('Эхлээд видео оруулна уу');
    }

    const result = await this.stt.transcribeUrl(videoUrl);
    if (!result.text) {
      throw new BadRequestException('Видеоноос яриа олдсонгүй — өөр видео оруулна уу');
    }

    const transcript: LessonTranscript = {
      text: result.text,
      seconds: result.seconds,
      at: new Date().toISOString(),
    };
    lesson.content = withTranscript(lesson.content, transcript);
    await this.lessons.save(lesson);

    await this.aiUsages.save(
      this.aiUsages.create({
        userId: adminId,
        type: AiUsageType.STT,
        model: 'scribe_v1',
        voiceSeconds: result.seconds,
        metadata: { purpose: 'lesson_transcript', lessonId: id },
      }),
    );

    return transcript;
  }

  /** Админы гараар засварласан бичвэрийг хадгална. */
  async saveTranscript(id: string, text: string): Promise<LessonTranscript> {
    const lesson = await this.findRaw(id);
    const previous = readTranscript(lesson.content);
    const transcript: LessonTranscript = {
      text,
      seconds: previous?.seconds ?? 0,
      at: previous?.at ?? new Date().toISOString(),
    };
    lesson.content = withTranscript(lesson.content, transcript);
    await this.lessons.save(lesson);
    return transcript;
  }
}
