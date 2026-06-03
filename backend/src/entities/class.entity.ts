import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinTable,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Assignment } from './assignment.entity';

/**
 * A class/group a teacher runs. Students join by entering its `joinCode`.
 *
 * Named `ClassEntity` because `Class` is a reserved word in TypeScript/JS.
 * The DB table is still `classes`.
 */
@Entity('classes')
export class ClassEntity extends BaseEntity {
  @Column()
  name: string;

  /** Short human-typable code students enter to enroll. Unique across the app. */
  @Index({ unique: true })
  @Column({ name: 'join_code' })
  joinCode: string;

  @ManyToOne(() => Organization, (org) => org.classes, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  /** The teacher who owns this class. */
  @ManyToOne(() => User, (user) => user.taughtClasses, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'teacher_id' })
  teacher: User | null;

  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  /** Enrolled students. Join table: class_students. */
  @ManyToMany(() => User, (user) => user.classes)
  @JoinTable({
    name: 'class_students',
    joinColumn: { name: 'class_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'student_id', referencedColumnName: 'id' },
  })
  students: User[];

  @OneToMany(() => Assignment, (assignment) => assignment.classEntity)
  assignments: Assignment[];
}
