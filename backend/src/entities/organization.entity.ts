import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { ClassEntity } from './class.entity';

/**
 * A school, company, or law firm. One app serves many org types, each with its
 * own users and (later) content track. Individual learners with no org have
 * organizationId = null.
 */
@Entity('organizations')
export class Organization extends BaseEntity {
  @Column()
  name: string;

  /**
   * Org type, e.g. "school", "company", "law_firm" — but open-ended. Stored as
   * free text (not an enum) so new types can be added from admin/DB without a
   * code change or migration. See ORG_TYPE_SUGGESTIONS for common defaults.
   */
  @Column()
  type: string;

  /** Optional free-form settings (branding, plan limits overrides, etc.). */
  @Column({ type: 'jsonb', nullable: true })
  settings: Record<string, unknown> | null;

  @OneToMany(() => User, (user) => user.organization)
  users: User[];

  @OneToMany(() => ClassEntity, (klass) => klass.organization)
  classes: ClassEntity[];
}
