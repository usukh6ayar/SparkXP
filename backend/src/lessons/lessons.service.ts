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

/** XP awarded the first time a student completes a lesson. */
const LESSON_XP = 15;

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

    const log = await this.xp.awardOnce({
      userId,
      amount: LESSON_XP,
      source: XpSource.LESSON,
      referenceId: lessonId,
    });
    return { lessonId, alreadyCompleted: log === null, xpAwarded: log ? LESSON_XP : 0 };
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
