import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ClassEntity } from './class.entity';
import { User } from './user.entity';

/**
 * A pending request from a student to join a class (entered the join code).
 * The student is NOT enrolled until the teacher approves — approving moves them
 * into `class_students` and deletes the request; rejecting just deletes it.
 *
 * Keeping pending requests in their own table means the class roster
 * (`class_students`) stays "approved students only", so roster / progress /
 * assignment logic needs no changes.
 */
@Entity('class_join_requests')
@Index(['classId', 'studentId'], { unique: true })
export class ClassJoinRequest extends BaseEntity {
  @ManyToOne(() => ClassEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  classEntity: ClassEntity;

  @Column({ name: 'class_id', type: 'uuid' })
  classId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: User;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;
}
