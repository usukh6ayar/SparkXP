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

  /** Enroll the current user into a class by its join code. */
  async join(joinCode: string, user: User): Promise<ClassDetail> {
    const code = joinCode.trim().toUpperCase();
    const klass = await this.classes.findOne({
      where: { joinCode: code },
      relations: { students: true, organization: true },
    });
    if (!klass) throw new NotFoundException('Ийм кодтой анги олдсонгүй');

    if (klass.students.some((s) => s.id === user.id)) {
      throw new ConflictException('Та энэ ангид аль хэдийн элссэн байна');
    }

    klass.students.push(user);
    await this.classes.save(klass);

    await this.inheritOrgLocation(user, klass);

    return this.toDetail(klass);
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

  // ── helpers ────────────────────────────────────────────────────────────────

  private isAdmin(user: User): boolean {
    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
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
