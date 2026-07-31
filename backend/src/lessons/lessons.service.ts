import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
import { XpService } from '../xp/xp.service';
import { XpSource } from '../common/enums';
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
      order: { level: 'ASC', position: 'ASC' },
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

  create(dto: CreateLessonDto): Promise<Lesson> {
    const lesson = this.lessons.create(dto);
    return this.lessons.save(lesson);
  }

  /** List lessons with optional filters and pagination. Ordered by `position`
   *  so a level/track shows in the intended sequence. */
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
      order: { position: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Lesson> {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) {
      throw new NotFoundException('Хичээл олдсонгүй');
    }
    return lesson;
  }

  async update(id: string, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.findOne(id);
    Object.assign(lesson, dto);
    return this.lessons.save(lesson);
  }

  async remove(id: string): Promise<void> {
    const lesson = await this.findOne(id);
    await this.lessons.remove(lesson);
  }
}
