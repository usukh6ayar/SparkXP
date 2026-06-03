import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { AssignmentType } from '../common/enums';
import { ClassEntity } from './class.entity';
import { User } from './user.entity';

/**
 * A piece of content (a lesson or a quiz) a teacher assigns to a class, with an
 * optional due date.
 *
 * We store the target as a polymorphic (type, targetId) pair rather than two
 * nullable FKs — simpler for MVP. The service resolves `targetId` against the
 * Lesson or Quiz table based on `type`.
 */
@Entity('assignments')
export class Assignment extends BaseEntity {
  @Column({ type: 'enum', enum: AssignmentType })
  type: AssignmentType;

  /** ID of the Lesson or Quiz this assignment points at (per `type`). */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  @ManyToOne(() => ClassEntity, (klass) => klass.assignments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  /** Teacher who created the assignment. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_by_id' })
  assignedBy: User | null;

  @Column({ name: 'assigned_by_id', type: 'uuid', nullable: true })
  assignedById: string | null;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt: Date | null;
}
