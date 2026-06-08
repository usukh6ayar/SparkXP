import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClassEntity } from '../entities/class.entity';
import { User } from '../entities/user.entity';
import { XpLog } from '../entities/xp-log.entity';
import { UserRole } from '../common/enums';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JoinClassDto } from './dto/join-class.dto';

function generateJoinCode(): string {
  // 6-char alphanumeric, uppercase — easy to type on a phone
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(XpLog)
    private readonly xpLogRepo: Repository<XpLog>,
    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateClassDto, teacher: User): Promise<ClassEntity> {
    let joinCode = generateJoinCode();
    // Retry on the rare collision
    while (await this.classRepo.findOne({ where: { joinCode } })) {
      joinCode = generateJoinCode();
    }
    const klass = this.classRepo.create({
      name: dto.name,
      joinCode,
      teacherId: teacher.id,
      organizationId: dto.organizationId ?? null,
    });
    return this.classRepo.save(klass);
  }

  /** Admin sees all; teacher sees own classes only. */
  findAll(caller: User): Promise<ClassEntity[]> {
    if (caller.role === UserRole.ADMIN || caller.role === UserRole.SUPER_ADMIN) {
      return this.classRepo.find({ relations: ['teacher', 'organization'], order: { name: 'ASC' } });
    }
    return this.classRepo.find({
      where: { teacherId: caller.id },
      relations: ['teacher', 'organization'],
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<ClassEntity> {
    const klass = await this.classRepo.findOne({
      where: { id },
      relations: ['teacher', 'organization', 'students'],
    });
    if (!klass) throw new NotFoundException('Class not found');
    return klass;
  }

  async update(id: string, dto: UpdateClassDto, caller: User): Promise<ClassEntity> {
    const klass = await this.findOne(id);
    this.assertOwnerOrAdmin(klass, caller);
    Object.assign(klass, dto);
    return this.classRepo.save(klass);
  }

  async remove(id: string, caller: User): Promise<void> {
    const klass = await this.findOne(id);
    this.assertOwnerOrAdmin(klass, caller);
    await this.classRepo.remove(klass);
  }

  /** Student joins a class by join_code. */
  async join(dto: JoinClassDto, student: User): Promise<{ message: string }> {
    const klass = await this.classRepo.findOne({
      where: { joinCode: dto.joinCode },
      relations: ['students'],
    });
    if (!klass) throw new NotFoundException('Invalid join code');

    const alreadyIn = klass.students.some((s) => s.id === student.id);
    if (alreadyIn) throw new ConflictException('Already enrolled in this class');

    klass.students.push(student);
    await this.classRepo.save(klass);
    return { message: 'Joined successfully' };
  }

  /** Student leaves a class. */
  async leave(classId: string, student: User): Promise<{ message: string }> {
    const klass = await this.classRepo.findOne({
      where: { id: classId },
      relations: ['students'],
    });
    if (!klass) throw new NotFoundException('Class not found');

    klass.students = klass.students.filter((s) => s.id !== student.id);
    await this.classRepo.save(klass);
    return { message: 'Left class successfully' };
  }

  /** Teacher dashboard: XP earned by each student this week, month, all-time. */
  async getProgress(classId: string, caller: User) {
    const klass = await this.findOne(classId);
    this.assertOwnerOrAdmin(klass, caller);

    const students = klass.students;

    if (students.length === 0) return { classId, students: [] };

    const studentIds = students.map((s) => s.id);

    // Sum XP per student for each period window
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const rows: { userId: string; xp_week: string; xp_month: string; xp_total: string }[] =
      await this.xpLogRepo
        .createQueryBuilder('log')
        .select('log.user_id', 'userId')
        .addSelect(`SUM(CASE WHEN log.created_at >= :weekAgo THEN log.amount ELSE 0 END)`, 'xp_week')
        .addSelect(`SUM(CASE WHEN log.created_at >= :monthAgo THEN log.amount ELSE 0 END)`, 'xp_month')
        .addSelect('SUM(log.amount)', 'xp_total')
        .where('log.user_id IN (:...studentIds)', { studentIds })
        .setParameter('weekAgo', weekAgo.toISOString())
        .setParameter('monthAgo', monthAgo.toISOString())
        .groupBy('log.user_id')
        .getRawMany();

    const xpMap = new Map(rows.map((r) => [r.userId, r]));

    return {
      classId,
      students: students.map((s) => {
        const row = xpMap.get(s.id);
        return {
          userId: s.id,
          fullName: s.fullName,
          email: s.email,
          xpWeek: row ? Number(row.xp_week) : 0,
          xpMonth: row ? Number(row.xp_month) : 0,
          xpTotal: row ? Number(row.xp_total) : 0,
          sparks: s.sparks,
        };
      }),
    };
  }

  private assertOwnerOrAdmin(klass: ClassEntity, caller: User): void {
    const isAdmin = caller.role === UserRole.ADMIN || caller.role === UserRole.SUPER_ADMIN;
    if (!isAdmin && klass.teacherId !== caller.id) {
      throw new ForbiddenException('Access denied');
    }
  }
}
