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
import { AssignmentType, UserRole, SubmissionStatus } from '../common/enums';
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

    // Resolve the target roster: explicit studentIds (validated against the class)
    // or the whole class. getStudents enforces teacher/admin access already.
    const roster = await this.classesService.getStudents(dto.classId, user);
    const rosterIds = new Set(roster.map((s) => s.id));
    let targetIds = roster.map((s) => s.id);
    if (dto.studentIds?.length) {
      const invalid = dto.studentIds.filter((id) => !rosterIds.has(id));
      if (invalid.length) {
        throw new BadRequestException('Сонгосон сурагч энэ ангид алга');
      }
      targetIds = dto.studentIds;
    }

    const assignment = await this.assignments.save(
      this.assignments.create({
        classId: dto.classId,
        type: dto.type,
        targetId: dto.targetId,
        assignedById: user.id,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        note: dto.note ?? null,
        studentIds: dto.studentIds?.length ? dto.studentIds : null,
      }),
    );

    // Pre-create one submission row per target so "pending / overdue" is queryable.
    if (targetIds.length) {
      await this.completions
        .createQueryBuilder()
        .insert()
        .into(AssignmentCompletion)
        .values(
          targetIds.map((studentId) => ({
            assignmentId: assignment.id,
            studentId,
            status: SubmissionStatus.ASSIGNED,
          })),
        )
        .orIgnore()
        .execute();
    }
    return assignment;
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

    // Batch-load completion counts for all assignments in one query.
    // Submissions are now pre-created with status ASSIGNED at assign time, so
    // completedCount must count only rows that were actually submitted
    // (completed/late) — excluding the still-pending ASSIGNED rows.
    const counts = await this.completions
      .createQueryBuilder('ac')
      .select('ac.assignment_id', 'assignmentId')
      .addSelect('COUNT(ac.id)', 'count')
      .where('ac.assignment_id IN (:...ids)', { ids: list.map((a) => a.id) })
      .andWhere('ac.status != :assigned', { assigned: SubmissionStatus.ASSIGNED })
      .groupBy('ac.assignment_id')
      .getRawMany<{ assignmentId: string; count: string }>();

    const countMap = new Map(counts.map((r) => [r.assignmentId, Number(r.count)]));
    return list.map((a) => Object.assign(a, { completedCount: countMap.get(a.id) ?? 0 }));
  }

  /**
   * Student marks an assignment as done (idempotent — delegates to recordSubmission).
   */
  async complete(assignmentId: string, userId: string): Promise<void> {
    await this.recordSubmission(assignmentId, userId, null);
  }

  /**
   * Mark a student's submission for an assignment: updates the pre-created row,
   * or inserts one if the student joined after the assign. `late` when past due.
   */
  async recordSubmission(
    assignmentId: string,
    studentId: string,
    scorePct: number | null,
  ): Promise<void> {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      select: { id: true, dueAt: true },
    });
    if (!assignment) throw new NotFoundException('Даалгавар олдсонгүй');
    const status =
      assignment.dueAt && new Date() > assignment.dueAt
        ? SubmissionStatus.LATE
        : SubmissionStatus.COMPLETED;

    const res = await this.completions
      .createQueryBuilder()
      .update(AssignmentCompletion)
      .set({
        status,
        scorePct: scorePct ?? undefined,
        submittedAt: () => 'now()',
        attemptCount: () => 'attempt_count + 1',
      })
      .where('assignment_id = :assignmentId AND student_id = :studentId', {
        assignmentId,
        studentId,
      })
      .execute();

    if (!res.affected) {
      await this.completions
        .createQueryBuilder()
        .insert()
        .into(AssignmentCompletion)
        .values({
          assignmentId,
          studentId,
          status,
          scorePct: scorePct ?? null,
          submittedAt: new Date(),
          attemptCount: 1,
        })
        .orIgnore()
        .execute();
    }
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

  /** Teacher view: every targeted student's submission for one assignment. */
  async submissionsFor(assignmentId: string, user: User) {
    const assignment = await this.assignments.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Даалгавар олдсонгүй');
    // Reuse class access control (throws 403 if not the class teacher/admin).
    await this.classesService.getStudents(assignment.classId, user);
    const rows = await this.completions.find({
      where: { assignmentId },
      relations: ['student'],
      order: { status: 'ASC', submittedAt: 'DESC' },
    });
    return rows.map((r) => ({
      studentId: r.studentId,
      fullName: r.student?.fullName ?? null,
      status: r.status,
      scorePct: r.scorePct,
      submittedAt: r.submittedAt,
      attemptCount: r.attemptCount,
    }));
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
