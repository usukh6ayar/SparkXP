import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson } from '../entities/lesson.entity';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { QueryLessonsDto } from './dto/query-lessons.dto';

export interface PaginatedLessons {
  items: Lesson[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
  ) {}

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
