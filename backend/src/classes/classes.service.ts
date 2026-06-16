import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { User } from '../entities/user.entity';
import { ClassJoinRequest } from '../entities/class-join-request.entity';
import { UserRole } from '../common/enums';
import { sanitizeUser, SafeUser } from '../common/utils/sanitize-user';
import { CreateClassDto } from './dto/create-class.dto';

/** Unambiguous alphabet for join codes (no 0/O, 1/I to avoid mistyping). */
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 6;

/** A class with its teacher and student roster, all password-hash-free. */
export interface ClassDetail {
  id: string;
  name: string;
  joinCode: string;
  organizationId: string | null;
  teacherId: string | null;
  teacher: SafeUser | null;
  students: SafeUser[];
  createdAt: Date;
  updatedAt: Date;
}

/** The classes relevant to a given user. */
export interface MyClasses {
  teaching: ClassEntity[];
  enrolled: ClassEntity[];
}

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classes: Repository<ClassEntity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(ClassJoinRequest)
    private readonly requests: Repository<ClassJoinRequest>,
  ) {}

  /** Create a class owned by `teacher`, with a freshly generated join code. */
  async create(dto: CreateClassDto, teacher: User): Promise<ClassEntity> {
    const klass = this.classes.create({
      name: dto.name,
      organizationId: dto.organizationId ?? null,
      teacherId: teacher.id,
      joinCode: await this.generateUniqueJoinCode(),
    });
    return this.classes.save(klass);
  }

  /** Classes the user teaches plus the ones they're enrolled in as a student. */
  async findForUser(user: User): Promise<MyClasses> {
    const teaching = await this.classes.find({
      where: { teacherId: user.id },
      order: { createdAt: 'DESC' },
    });

    const enrolled = await this.classes
      .createQueryBuilder('class')
      .innerJoin('class.students', 'student', 'student.id = :uid', {
        uid: user.id,
      })
      .orderBy('class.created_at', 'DESC')
      .getMany();

    return { teaching, enrolled };
  }

  /** Get a class with its roster. Only the teacher, an enrolled student, or an
   *  admin may view it. */
  async findOneWithAccess(id: string, user: User): Promise<ClassDetail> {
    const klass = await this.classes.findOne({
      where: { id },
      relations: { teacher: true, students: true },
    });
    if (!klass) throw new NotFoundException('Анги олдсонгүй');

    const isAdmin = this.isAdmin(user);
    const isTeacher = klass.teacherId === user.id;
    const isStudent = klass.students.some((s) => s.id === user.id);
    if (!isAdmin && !isTeacher && !isStudent) {
      throw new ForbiddenException('Энэ ангид хандах эрхгүй байна');
    }

    return this.toDetail(klass);
  }

  /**
   * Request to join a class by its code. The student is NOT enrolled yet — a
   * pending request is created and the teacher must approve it. This stops
   * anyone who happens to know the code from silently joining.
   */
  async join(
    joinCode: string,
    user: User,
  ): Promise<{ status: 'pending'; className: string }> {
    const code = joinCode.trim().toUpperCase();
    const klass = await this.classes.findOne({
      where: { joinCode: code },
      relations: { students: true },
    });
    if (!klass) throw new NotFoundException('Ийм кодтой анги олдсонгүй');

    if (klass.teacherId === user.id) {
      throw new ConflictException('Та энэ ангийн багш байна');
    }
    if (klass.students.some((s) => s.id === user.id)) {
      throw new ConflictException('Та энэ ангид аль хэдийн элссэн байна');
    }

    const existing = await this.requests.findOne({
      where: { classId: klass.id, studentId: user.id },
    });
    if (existing) {
      throw new ConflictException('Хүсэлт илгээгдсэн, багшийн зөвшөөрлийг хүлээнэ үү');
    }

    await this.requests.save(
      this.requests.create({ classId: klass.id, studentId: user.id }),
    );
    return { status: 'pending', className: klass.name };
  }

  /** Pending join requests for a class (teacher of the class / admin only). */
  async getJoinRequests(classId: string, user: User): Promise<SafeUser[]> {
    const klass = await this.classes.findOne({ where: { id: classId } });
    if (!klass) throw new NotFoundException('Анги олдсонгүй');
    this.assertTeacherOrAdmin(klass, user);

    const reqs = await this.requests.find({
      where: { classId },
      relations: { student: true },
      order: { createdAt: 'ASC' },
    });
    return reqs.map((r) => sanitizeUser(r.student));
  }

  /** Approve a pending request: enroll the student and drop the request. */
  async approveRequest(
    classId: string,
    studentId: string,
    user: User,
  ): Promise<ClassDetail> {
    const klass = await this.classes.findOne({
      where: { id: classId },
      relations: { students: true, organization: true },
    });
    if (!klass) throw new NotFoundException('Анги олдсонгүй');
    this.assertTeacherOrAdmin(klass, user);

    const req = await this.requests.findOne({ where: { classId, studentId } });
    if (!req) throw new NotFoundException('Хүсэлт олдсонгүй');

    const student = await this.users.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Сурагч олдсонгүй');

    if (!klass.students.some((s) => s.id === studentId)) {
      klass.students.push(student);
      await this.classes.save(klass);
      await this.inheritOrgLocation(student, klass);
    }
    await this.requests.remove(req);

    return this.findOneWithAccess(classId, user);
  }

  /** Reject (delete) a pending request without enrolling the student. */
  async rejectRequest(
    classId: string,
    studentId: string,
    user: User,
  ): Promise<void> {
    const klass = await this.classes.findOne({ where: { id: classId } });
    if (!klass) throw new NotFoundException('Анги олдсонгүй');
    this.assertTeacherOrAdmin(klass, user);

    const req = await this.requests.findOne({ where: { classId, studentId } });
    if (!req) throw new NotFoundException('Хүсэлт олдсонгүй');
    await this.requests.remove(req);
  }

  /** The student roster of a class (teacher of the class or admin only). */
  async getStudents(id: string, user: User): Promise<SafeUser[]> {
    const detail = await this.findOneWithAccess(id, user);
    // findOneWithAccess already allows enrolled students; restrict the roster
    // to the teacher / admin so students can't enumerate classmates' data.
    if (!this.isAdmin(user) && detail.teacherId !== user.id) {
      throw new ForbiddenException('Зөвхөн багш сурагчдын жагсаалтыг харна');
    }
    return detail.students;
  }

  /** Admin: all classes with teacher info and student count. */
  async findAll(): Promise<{
    id: string; name: string; joinCode: string;
    teacherId: string | null; teacherName: string | null;
    studentCount: number; createdAt: Date;
  }[]> {
    const classes = await this.classes.find({
      relations: { teacher: true, students: true },
      order: { createdAt: 'DESC' },
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      joinCode: c.joinCode,
      teacherId: c.teacherId,
      teacherName: c.teacher?.fullName ?? null,
      studentCount: (c.students ?? []).length,
      createdAt: c.createdAt,
    }));
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private isAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  }

  /** Throw unless the user is this class's teacher or an admin. */
  private assertTeacherOrAdmin(klass: ClassEntity, user: User): void {
    if (!this.isAdmin(user) && klass.teacherId !== user.id) {
      throw new ForbiddenException('Зөвхөн ангийн багш энэ үйлдлийг хийнэ');
    }
  }

  /** Shape a loaded class (with relations) into a hash-free response object. */
  private toDetail(klass: ClassEntity): ClassDetail {
    return {
      id: klass.id,
      name: klass.name,
      joinCode: klass.joinCode,
      organizationId: klass.organizationId,
      teacherId: klass.teacherId,
      teacher: klass.teacher ? sanitizeUser(klass.teacher) : null,
      students: (klass.students ?? []).map(sanitizeUser),
      createdAt: klass.createdAt,
      updatedAt: klass.updatedAt,
    };
  }

  /**
   * When a student joins a class that belongs to an organization, copy the
   * org's location onto the student (if not already set) so they show up in the
   * right local leaderboard. Also links them to the org.
   */
  private async inheritOrgLocation(
    user: User,
    klass: ClassEntity,
  ): Promise<void> {
    const org = klass.organization;
    if (!org) return;

    const patch: {
      organizationId?: string;
      province?: string;
      district?: string;
    } = {};
    if (!user.organizationId) patch.organizationId = org.id;
    if (!user.province && org.province) patch.province = org.province;
    if (!user.district && org.district) patch.district = org.district;

    if (Object.keys(patch).length > 0) {
      await this.users.update(user.id, patch);
    }
  }

  /** Generate a random join code, retrying until it's unique in the table. */
  private async generateUniqueJoinCode(): Promise<string> {
    // Practically never loops more than once given the code space (~10^9).
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = this.randomCode();
      const exists = await this.classes.findOne({
        where: { joinCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new ConflictException('Анги нэгдэх код үүсгэж чадсангүй, дахин оролдоно уу');
  }

  private randomCode(): string {
    let code = '';
    for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
      const idx = Math.floor(Math.random() * JOIN_CODE_ALPHABET.length);
      code += JOIN_CODE_ALPHABET[idx];
    }
    return code;
  }
}
