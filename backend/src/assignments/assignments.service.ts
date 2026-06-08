import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Assignment } from '../entities/assignment.entity';
import { ClassEntity } from '../entities/class.entity';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { QueryAssignmentsDto } from './dto/query-assignments.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    @InjectRepository(Assignment)
    private readonly assignmentRepo: Repository<Assignment>,
    @InjectRepository(ClassEntity)
    private readonly classRepo: Repository<ClassEntity>,
  ) {}

  async create(dto: CreateAssignmentDto, teacher: User): Promise<Assignment> {
    const klass = await this.classRepo.findOne({ where: { id: dto.classId } });
    if (!klass) throw new NotFoundException('Class not found');

    const isAdmin = teacher.role === UserRole.ADMIN || teacher.role === UserRole.SUPER_ADMIN;
    if (!isAdmin && klass.teacherId !== teacher.id) {
      throw new ForbiddenException('You can only assign to your own classes');
    }

    const assignment = this.assignmentRepo.create({
      classId: dto.classId,
      type: dto.type,
      targetId: dto.targetId,
      assignedById: teacher.id,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
    });
    return this.assignmentRepo.save(assignment);
  }

  /** Teacher/admin lists assignments, optionally filtered by class. */
  findAll(query: QueryAssignmentsDto, caller: User): Promise<Assignment[]> {
    const qb = this.assignmentRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.classEntity', 'class')
      .leftJoinAndSelect('a.assignedBy', 'teacher')
      .orderBy('a.created_at', 'DESC');

    if (query.classId) {
      qb.where('a.class_id = :classId', { classId: query.classId });
    } else if (caller.role === UserRole.TEACHER) {
      // Teachers without a class filter only see their own assignments
      qb.innerJoin('a.classEntity', 'c2', 'c2.teacher_id = :teacherId', {
        teacherId: caller.id,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<Assignment> {
    const a = await this.assignmentRepo.findOne({
      where: { id },
      relations: ['classEntity', 'assignedBy'],
    });
    if (!a) throw new NotFoundException('Assignment not found');
    return a;
  }

  async remove(id: string, caller: User): Promise<void> {
    const a = await this.findOne(id);
    const isAdmin = caller.role === UserRole.ADMIN || caller.role === UserRole.SUPER_ADMIN;
    if (!isAdmin && a.assignedById !== caller.id) {
      throw new ForbiddenException('Access denied');
    }
    await this.assignmentRepo.remove(a);
  }

  /** Student: fetch assignments for all classes they are enrolled in. */
  findMyAssignments(student: User): Promise<Assignment[]> {
    return this.assignmentRepo
      .createQueryBuilder('a')
      .innerJoin('a.classEntity', 'c')
      .innerJoin('c.students', 's', 's.id = :studentId', { studentId: student.id })
      .leftJoinAndSelect('a.classEntity', 'class')
      .orderBy('a.due_at', 'ASC', 'NULLS LAST')
      .getMany();
  }
}
