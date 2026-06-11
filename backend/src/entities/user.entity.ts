import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { UserRole } from '../common/enums';
import { Organization } from './organization.entity';
import { ClassEntity } from './class.entity';
import { WordReview } from './word-review.entity';
import { XpLog } from './xp-log.entity';
import { AiUsage } from './ai-usage.entity';
import { Message } from './message.entity';
import { Payment } from './payment.entity';
import { Plan } from './plan.entity';

/**
 * Every person in the system — student, teacher, admin, super_admin — lives in
 * this single table. The `role` field gates what they can do.
 *
 * Gamification counters live here for fast reads:
 *  - `xp`     lifetime progress (the source of truth is XpLog; this is a cache).
 *  - `sparks` spendable currency balance.
 */
@Entity('users')
export class User extends BaseEntity {
  @Index({ unique: true })
  @Column()
  email: string;

  /** bcrypt/argon hash — never the plaintext password. */
  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'full_name' })
  fullName: string;

  /** Optional display name chosen at registration (e.g. "Bold123"). */
  @Index({ unique: true, where: '"username" IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  /** Phone number (Mongolian format: 8 digits). Used for teacher/student contact. */
  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.STUDENT })
  role: UserRole;

  /** Achievement trophies collected by the user (slug list). e.g. ["first_quiz", "streak_7"]. */
  @Column({ type: 'jsonb', nullable: true })
  trophies: string[] | null;

  // --- Gamification ---
  @Column({ type: 'int', default: 0 })
  xp: number;

  @Column({ type: 'int', default: 0 })
  sparks: number;

  // --- Location (for local leaderboards: by province / district) ---
  // Stored on the User so leaderboard queries stay simple. Populated either
  // from registration (user picks) or inherited from their school/org.
  @Index()
  @Column({ type: 'varchar', nullable: true })
  province: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  district: string | null;

  @Column({ type: 'varchar', default: 'MN' })
  country: string;

  // --- Subscription plan ---
  @ManyToOne(() => Plan, (plan) => plan.subscribers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  /** When the active plan expires (null = no active plan). */
  @Column({ name: 'plan_expires_at', type: 'timestamptz', nullable: true })
  planExpiresAt: Date | null;

  // --- Org membership (null for individual learners) ---
  @ManyToOne(() => Organization, (org) => org.users, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  /** Classes this user is enrolled in as a student (joined via join_code). */
  @ManyToMany(() => ClassEntity, (klass) => klass.students)
  classes: ClassEntity[];

  /** Classes this user teaches (teacher role). */
  @OneToMany(() => ClassEntity, (klass) => klass.teacher)
  taughtClasses: ClassEntity[];

  // --- Activity relations ---
  @OneToMany(() => WordReview, (review) => review.user)
  wordReviews: WordReview[];

  @OneToMany(() => XpLog, (log) => log.user)
  xpLogs: XpLog[];

  @OneToMany(() => AiUsage, (usage) => usage.user)
  aiUsages: AiUsage[];

  @OneToMany(() => Message, (message) => message.user)
  messages: Message[];

  @OneToMany(() => Payment, (payment) => payment.user)
  payments: Payment[];
}
