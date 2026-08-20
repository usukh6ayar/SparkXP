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
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { normalizeIndexes } from './question-subset';

/**
 * Даалгаврын мөр + аппад харуулахад хэрэгтэй нэмэлт талбарууд.
 *
 * `targetTitle` серверээс ирэх нь **заавал**: даалгаврын сангийн тест нь
 * сурагчийн `GET /quizzes` жагсаалтад огт харагдахгүй тул апп гарчгийг өөрөө
 * олж чадахгүй (өмнө нь бүх хичээл+quiz-ийг татаад id-гаар нь тааруулдаг
 * байсан — одоо тэр нь «—» гэж гарна).
 */
type AssignmentView = Assignment & {
  targetTitle: string | null;
  /**
   * Сорилын **сэдэв** (`Quiz.topic`). Багш нэг дор Present Simple ба Modal
   * verbs хоёрыг өгч болох тул сурагч аль нь юу болохыг эндээс ялгана.
   */
  targetTopic: string | null;
  /** Сурагчийн үнэхээр хийх асуултын тоо (quiz даалгаварт). */
  questionCount: number | null;
};

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
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Даалгавар оноох. Зөвхөн тухайн ангийн багш (эсвэл админ).
   *
   * **Нэг илгээлт → олон даалгавар.** Багш «Present Simple»-ээс 3, «Modal
   * verbs»-ээс 2 асуулт сонгож нэг дор явуулж болно. Сэдэв бүр өөрийн тестээс
   * ирдэг тул мөр нь тусдаа үүснэ (сурагч ч, багш ч аль сэдэв нь юу болохыг
   * ялгаж харна), харин **мэдэгдэл нэг** очно — 5 push илгээх нь сурагчийн
   * хувьд шийтгэл болно.
   */
  async create(dto: CreateAssignmentDto, user: User): Promise<Assignment[]> {
    // findOneWithAccess throws 404/403 if the class is missing or the user
    // isn't a member; then we further require teacher/admin to author content.
    const klass = await this.classesService.findOneWithAccess(
      dto.classId,
      user,
    );
    if (!this.isAdmin(user) && klass.teacherId !== user.id) {
      throw new ForbiddenException('Зөвхөн ангийн багш даалгавар онооно');
    }

    const picks = resolveTargets(dto);
    const targets = await Promise.all(
      picks.map(async (pick) => {
        const target = await this.assertTargetExists(dto.type, pick.targetId);
        // Хичээлд асуулт гэж байхгүй тул асуулт сонгох нь зөвхөн сорилд.
        if (pick.questionIndexes?.length && dto.type !== AssignmentType.QUIZ) {
          throw new BadRequestException(
            'Асуулт сонгох нь зөвхөн сорилд боломжтой',
          );
        }
        return {
          ...target,
          targetId: pick.targetId,
          questionIndexes:
            dto.type === AssignmentType.QUIZ
              ? normalizeIndexes(pick.questionIndexes, target.questionCount ?? 0)
              : null,
        };
      }),
    );

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

    const assignments = await this.assignments.save(
      targets.map((target) =>
        this.assignments.create({
          classId: dto.classId,
          type: dto.type,
          targetId: target.targetId,
          assignedById: user.id,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
          note: dto.note ?? null,
          studentIds: dto.studentIds?.length ? dto.studentIds : null,
          questionIndexes: target.questionIndexes,
        }),
      ),
    );

    // Pre-create one submission row per (assignment, target student) so
    // "pending / overdue" is queryable.
    if (targetIds.length) {
      await this.completions
        .createQueryBuilder()
        .insert()
        .into(AssignmentCompletion)
        .values(
          assignments.flatMap((assignment) =>
            targetIds.map((studentId) => ({
              assignmentId: assignment.id,
              studentId,
              status: SubmissionStatus.ASSIGNED,
            })),
          ),
        )
        .orIgnore()
        .execute();
    }

    // Tell the students a task arrived — the whole point of the feature: the
    // class disperses and the homework still reaches them. Best-effort by
    // design (notifyUsers swallows its own errors), so a push outage can never
    // make assigning homework fail.
    await this.notifications.notifyUsers(targetIds, {
      title: 'Шинэ даалгавар',
      body: assignmentNotificationBody(
        targets.map((t) => t.title),
        assignments[0].dueAt,
      ),
      data: {
        type: 'assignment',
        url: '/assignments',
        // Нэг илгээлтэд олон мөр үүсч болох тул мэдэгдэл жагсаалт руу аваачна;
        // `assignmentId` нь ганц байхад л утгатай (хуучин client-үүд уншина).
        assignmentId: assignments.length === 1 ? assignments[0].id : undefined,
      },
    });

    return assignments;
  }

  /**
   * List a class's assignments with completion counts.
   * Any member of the class (or admin) may read.
   */
  async findForClass(
    classId: string,
    user: User,
  ): Promise<(AssignmentView & { completedCount: number })[]> {
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
    return this.attachTargets(
      list.map((a) =>
        Object.assign(a, { completedCount: countMap.get(a.id) ?? 0 }),
      ),
    );
  }

  /**
   * Student marks an assignment as done (idempotent — delegates to recordSubmission).
   */
  async complete(assignmentId: string, userId: string): Promise<void> {
    await this.recordSubmission(assignmentId, userId, null);
  }

  /**
   * Is this quiz homework the student's teacher set for them?
   *
   * Teacher-assigned work sits OUTSIDE the gamification loop: it costs no
   * hearts and earns no XP (see API.md §6a). It behaves like ordinary school
   * homework — the submission is still recorded for the teacher's dashboard.
   *
   * Deliberately derived server-side rather than trusting an `assignmentId`
   * from the client: the answer decides whether a heart is charged, so a
   * client-supplied flag would be a free-hearts switch.
   *
   * Matches on the class roster (not the pre-created completion row) so a
   * student who joined AFTER the assignment was set is still covered.
   */
  isAssignedWork(userId: string, quizId: string): Promise<boolean> {
    return this.isAssigned(userId, AssignmentType.QUIZ, quizId);
  }

  /**
   * Is this lesson homework the student's teacher set for them?
   *
   * Drives the free-lesson quota: assigned lessons are always free to open, so
   * a student can never be paywalled out of their own homework.
   */
  isAssignedLesson(userId: string, lessonId: string): Promise<boolean> {
    return this.isAssigned(userId, AssignmentType.LESSON, lessonId);
  }

  /** Shared membership test behind both `isAssigned*` methods above. */
  private async isAssigned(
    userId: string,
    type: AssignmentType,
    targetId: string,
  ): Promise<boolean> {
    const count = await this.assignedToStudent(userId)
      .andWhere('a.type = :type', { type })
      .andWhere('a.target_id = :targetId', { targetId })
      .limit(1)
      .getCount();
    return count > 0;
  }

  /**
   * Сурагчийн гүйцэтгэж буй **тодорхой** даалгавар — үнэхээр түүнийх мөн үү,
   * энэ контент руу заасан уу гэдгийг шалгасны дараа буцаана (үгүй бол `null`).
   *
   * Юунд хэрэгтэй вэ: багш нэг тестээс 5 асуулт сонгосон бол `questionIndexes`
   * нь тэр даалгаврын мөрөнд байдаг — сервер асуултыг шүүхийн тулд аль мөр
   * болохыг мэдэх ёстой. `assignmentId` нь client-ээс ирдэг тул **эзэмшлийг
   * нь энд заавал шалгана**: эс бөгөөс өөр ангийн даалгаврын id хавчуулж
   * нуугдсан контентыг нээх боломжтой болно.
   */
  findStudentAssignment(
    userId: string,
    type: AssignmentType,
    targetId: string,
    assignmentId?: string | null,
  ): Promise<Assignment | null> {
    const qb = this.assignedToStudent(userId)
      .andWhere('a.type = :type', { type })
      .andWhere('a.target_id = :targetId', { targetId });
    if (assignmentId) qb.andWhere('a.id = :assignmentId', { assignmentId });
    // `assignmentId`-гүй бол хамгийн сүүлд өгсөн даалгавар. Ингэснээр
    // шинэчлээгүй хуучин апп (id дамжуулдаггүй) ч зөв дэд олонлогоо авна.
    return qb.orderBy('a.created_at', 'DESC').getOne();
  }

  /**
   * «Энэ сурагчид оногдсон даалгаврууд» гэсэн үндсэн query.
   *
   * Ангийн бүртгэлээр (тухайн үеийн completion мөрөөр биш) тааруулдаг тул
   * даалгавар өгөгдсөний ДАРАА элссэн сурагч ч хамрагдана.
   */
  private assignedToStudent(userId: string) {
    return this.assignments
      .createQueryBuilder('a')
      .innerJoin(
        'class_students',
        'cs',
        'cs.class_id = a.class_id AND cs.student_id = :userId',
        { userId },
      )
      // studentIds null = the whole class; otherwise only the listed students.
      .where('(a.student_ids IS NULL OR a.student_ids @> :me::jsonb)', {
        me: JSON.stringify([userId]),
      });
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

  /**
   * All assignments across the classes the current user is enrolled in, each
   * annotated with THIS student's own submission state (status + score) so the
   * "My Assignments" screen can show Хийсэн/Хоцорсон + %. Without this the rows
   * come back with no status and never reflect a completed assignment.
   */
  async findForStudent(
    user: User,
  ): Promise<
    (AssignmentView & { status: SubmissionStatus; scorePct: number | null })[]
  > {
    const { enrolled } = await this.classesService.findForUser(user);
    const classIds = enrolled.map((c) => c.id);
    if (classIds.length === 0) return [];

    const assignments = await this.assignments.find({
      where: { classId: In(classIds) },
      order: { dueAt: 'ASC', createdAt: 'DESC' },
    });
    if (assignments.length === 0) return [];

    // One completion row per (assignment, this student) — attach its state.
    const completions = await this.completions.find({
      where: {
        assignmentId: In(assignments.map((a) => a.id)),
        studentId: user.id,
      },
    });
    const byAssignment = new Map(completions.map((c) => [c.assignmentId, c]));
    return this.attachTargets(
      assignments.map((a) =>
        Object.assign(a, {
          status: byAssignment.get(a.id)?.status ?? SubmissionStatus.ASSIGNED,
          scorePct: byAssignment.get(a.id)?.scorePct ?? null,
        }),
      ),
    );
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

  /**
   * Даалгаврын мөрүүдэд **харагдах** мэдээлэл нэмнэ: гарчиг · сэдэв · хийх
   * асуултын тоо. Хоёр query (хичээлүүд + сорилууд), мөрийн тоо хамаагүй.
   *
   * ⚠️ Урьд нь апп гарчгийг өөрөө олдог байсан — бүх хичээл, бүх сорилыг
   * татаад id-гаар нь тааруулна. Даалгаврын сангийн тест сурагчийн жагсаалтад
   * ОГТ харагдахгүй болсон тул тэр арга «—» гэж гаргана. Тиймээс гарчгийг
   * сервер өгөх ёстой (нэмээд аппын 2 илүү хүсэлт хэмнэгдэнэ).
   */
  private async attachTargets<T extends Assignment>(
    list: T[],
  ): Promise<(T & Pick<AssignmentView, 'targetTitle' | 'targetTopic' | 'questionCount'>)[]> {
    const idsOf = (type: AssignmentType) =>
      list.filter((a) => a.type === type).map((a) => a.targetId);
    const lessonIds = idsOf(AssignmentType.LESSON);
    const quizIds = idsOf(AssignmentType.QUIZ);

    const [lessons, quizzes] = await Promise.all([
      lessonIds.length
        ? this.lessons.find({
            where: { id: In(lessonIds) },
            select: { id: true, title: true },
          })
        : [],
      quizIds.length
        ? this.quizzes.find({
            where: { id: In(quizIds) },
            select: { id: true, title: true, topic: true, questions: true },
          })
        : [],
    ]);
    const lessonById = new Map(lessons.map((l) => [l.id, l]));
    const quizById = new Map(quizzes.map((q) => [q.id, q]));

    return list.map((a) => {
      if (a.type === AssignmentType.LESSON) {
        return Object.assign(a, {
          targetTitle: lessonById.get(a.targetId)?.title ?? null,
          targetTopic: null,
          questionCount: null,
        });
      }
      const quiz = quizById.get(a.targetId);
      const total = quiz?.questions?.length ?? 0;
      // Даалгавар өгсний дараа тестээс асуулт хасагдсан байж болно. Тоолол нь
      // `subsetQuiz`-тэй яг ижил дүрмээр: байхгүй индексийг алгасах, нэг ч
      // үлдэхгүй бол бүтэн тест.
      const picked =
        a.questionIndexes?.filter((i) => i >= 0 && i < total).length ?? 0;
      return Object.assign(a, {
        targetTitle: quiz?.title ?? null,
        targetTopic: quiz?.topic ?? null,
        questionCount: a.questionIndexes ? picked || total : total,
      });
    });
  }

  /**
   * Оноох гэж буй хичээл/сорил үнэхээр байгаа эсэхийг шалгаад, харуулахад
   * хэрэгтэй мэдээллийг нь буцаана: гарчиг (мэдэгдэлд), сэдэв (сурагч аль
   * сэдвийн даалгавар болохыг ялгахад), асуултын тоо (индекс шалгахад).
   */
  private async assertTargetExists(
    type: AssignmentType,
    targetId: string,
  ): Promise<{ title: string; topic: string | null; questionCount: number | null }> {
    if (type === AssignmentType.LESSON) {
      const lesson = await this.lessons.findOne({
        where: { id: targetId },
        select: { id: true, title: true },
      });
      if (!lesson) throw new BadRequestException('Оноох хичээл олдсонгүй');
      return { title: lesson.title, topic: null, questionCount: null };
    }

    const quiz = await this.quizzes.findOne({
      where: { id: targetId },
      select: { id: true, title: true, topic: true, questions: true },
    });
    if (!quiz) throw new BadRequestException('Оноох сорил олдсонгүй');
    return {
      title: quiz.title,
      topic: quiz.topic ?? null,
      questionCount: quiz.questions?.length ?? 0,
    };
  }
}

/**
 * Нэг илгээлтийн доторх оноох зүйлсийг гаргаж авна.
 *
 * `targets` (олон сэдэв) ба `targetId` (ганц) хоёрын **яг нэгийг** хүлээж авна
 * — хоёуланг нь зөвшөөрвөл аль нь давамгайлахыг таамаглах шаардлагатай болно.
 */
function resolveTargets(
  dto: CreateAssignmentDto,
): { targetId: string; questionIndexes?: number[] }[] {
  if (dto.targets?.length && dto.targetId) {
    throw new BadRequestException(
      'targets эсвэл targetId — аль нэгийг нь илгээнэ үү',
    );
  }
  if (dto.targets?.length) return dto.targets;
  if (dto.targetId) {
    return [{ targetId: dto.targetId, questionIndexes: dto.questionIndexes }];
  }
  throw new BadRequestException('Оноох контент сонгоогүй байна');
}

/**
 * The one-line push body: names the task, and the deadline when there is one.
 *
 * Rounds UP so "дуусахад 20 цаг үлдлээ" reads as "1 өдөр" rather than "0" —
 * a deadline notification that says zero days is worse than no number at all.
 */
function assignmentNotificationBody(titles: string[], dueAt: Date | null): string {
  // Олон сэдвийг нэг мөрөнд жагсаавал push таслагдана — тоог нь хэлэх нь
  // тодорхой, жагсаалтыг аппаас харна.
  const task =
    titles.length === 1
      ? `Багш "${titles[0]}" даалгавар өглөө.`
      : `Багш ${titles.length} даалгавар өглөө.`;
  if (!dueAt) return task;

  const days = Math.ceil((dueAt.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return `${task} Хугацаа нь дууссан байна.`;
  if (days === 1) return `${task} Маргааш дуусна.`;
  return `${task} ${days} хоногийн дараа дуусна.`;
}
