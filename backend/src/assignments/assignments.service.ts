import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Assignment } from '../entities/assignment.entity';
import { AssignmentCompletion } from '../entities/assignment-completion.entity';
import { Lesson } from '../entities/lesson.entity';
import { Quiz } from '../entities/quiz.entity';
import { User } from '../entities/user.entity';
import { AssignmentType, UserRole } from '../common/enums';
import { ClassesService } from '../classes/classes.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignments: Repository<Assignment>,
    @InjectRepository(AssignmentCompletion)
    private readonly completions: Repository<AssignmentCompletion>,
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(Quiz)
    private readonly quizzes: Repository<Quiz>,
    private readonly classesService: ClassesService,
  ) {}

  /** Create an assignment. Only the class's teacher (or an admin) may do this. */
  async create(dto: CreateAssignmentDto, user: User): Promise<Assignment> {
    // findOneWithAccess throws 404/403 if the class is missing or the user
    // isn't a member; then we further require teacher/admin to author content.
    const klass = await this.classesService.findOneWithAccess(
      dto.classId,
      user,
    );
    if (!this.isAdmin(user) && klass.teacherId !== user.id) {
      throw new ForbiddenException('Зөвхөн ангийн багш даалгавар онооно');
    }

    await this.assertTargetExists(dto.type, dto.targetId);

    const assignment = this.assignments.create({
      classId: dto.classId,
      type: dto.type,
      targetId: dto.targetId,
      assignedById: user.id,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    });
    return this.assignments.save(assignment);
  }

  /**
   * List a class's assignments with completion counts.
   * Any member of the class (or admin) may read.
   */
  async findForClass(classId: string, user: User): Promise<(Assignment & { completedCount: number })[]> {
    await this.classesService.findOneWithAccess(classId, user);
    const list = await this.assignments.find({
      where: { classId },
      order: { createdAt: 'DESC' },
    });
    if (list.length === 0) return [];

    // Batch-load completion counts for all assignments in one query
    const counts = await this.completions
      .createQueryBuilder('ac')
      .select('ac.assignment_id', 'assignmentId')
      .addSelect('COUNT(ac.id)', 'count')
      .where('ac.assignment_id IN (:...ids)', { ids: list.map((a) => a.id) })
      .groupBy('ac.assignment_id')
      .getRawMany<{ assignmentId: string; count: string }>();

    const countMap = new Map(counts.map((r) => [r.assignmentId, Number(r.count)]));
    return list.map((a) => Object.assign(a, { completedCount: countMap.get(a.id) ?? 0 }));
  }

  /**
   * Student marks an assignment as done (idempotent — duplicate calls are silently ignored).
   */
  async complete(assignmentId: string, userId: string): Promise<void> {
    const assignment = await this.assignments.findOne({ where: { id: assignmentId }, select: { id: true } });
    if (!assignment) throw new NotFoundException('Даалгавар олдсонгүй');
    await this.completions
      .createQueryBuilder()
      .insert()
      .into(AssignmentCompletion)
      .values({ assignmentId, studentId: userId })
      .orIgnore()
      .execute();
  }

  /** All assignments across the classes the current user is enrolled in. */
  async findForStudent(user: User): Promise<Assignment[]> {
    const { enrolled } = await this.classesService.findForUser(user);
    const classIds = enrolled.map((c) => c.id);
    if (classIds.length === 0) return [];

    return this.assignments.find({
      where: { classId: In(classIds) },
      order: { dueAt: 'ASC', createdAt: 'DESC' },
    });
  }

  /** Delete an assignment. Only the class's teacher (or an admin) may do this. */
  async remove(id: string, user: User): Promise<void> {
    const assignment = await this.assignments.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Даалгавар олдсонгүй');

    const klass = await this.classesService.findOneWithAccess(
      assignment.classId,
      user,
    );
    if (!this.isAdmin(user) && klass.teacherId !== user.id) {
      throw new ForbiddenException('Зөвхөн ангийн багш даалгавар устгана');
    }

    await this.assignments.remove(assignment);
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private isAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  /** Make sure the lesson/quiz being assigned actually exists. */
  private async assertTargetExists(
    type: AssignmentType,
    targetId: string,
  ): Promise<void> {
    const repo = type === AssignmentType.LESSON ? this.lessons : this.quizzes;
    const found = await repo.findOne({
      where: { id: targetId },
      select: { id: true },
    });
    if (!found) {
      throw new BadRequestException(
        type === AssignmentType.LESSON
          ? 'Оноох хичээл олдсонгүй'
          : 'Оноох сорил олдсонгүй',
      );
    }
  }
}
