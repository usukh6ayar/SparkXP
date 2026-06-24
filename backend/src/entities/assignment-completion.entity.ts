import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Assignment } from './assignment.entity';
import { User } from './user.entity';

/**
 * Records that a student has completed an assignment.
 * One row per (assignment, student) pair — unique constraint prevents duplicates.
 * Admin / teacher sees completedCount = count of rows WHERE assignmentId = X.
 */
@Entity('assignment_completions')
@Unique(['assignmentId', 'studentId'])
export class AssignmentCompletion extends BaseEntity {
  @ManyToOne(() => Assignment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assignment_id' })
  assignment: Assignment;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;
}
