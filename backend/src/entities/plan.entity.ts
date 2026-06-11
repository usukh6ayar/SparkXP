import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * Subscription plan sold to individual users (Standard / Plus / Premier).
 * Amount is stored in MNT minor units (tögrög — no decimal in MNT).
 * Admins can create/update plans from the dashboard without a code deploy.
 */
@Entity('plans')
export class Plan extends BaseEntity {
  /** Human-readable name shown to users. */
  @Column()
  name: string;

  /** URL-safe identifier, e.g. "standard", "plus", "premier". */
  @Column({ unique: true })
  slug: string;

  /** Price in MNT (integer). */
  @Column({ name: 'price_amount', type: 'int' })
  priceAmount: number;

  /** How many days of access this plan grants. */
  @Column({ name: 'duration_days', type: 'int', default: 30 })
  durationDays: number;

  /** Feature list / marketing copy stored as jsonb. */
  @Column({ type: 'jsonb', nullable: true })
  features: string[] | null;

  /** False = hidden from new purchases (keep for historical records). */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => User, (user) => user.plan)
  subscribers: User[];
}
