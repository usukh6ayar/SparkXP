import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Plan } from './plan.entity';
import { User } from './user.entity';

/**
 * What a promo code gives.
 * - `free_access`      → `value` days of `plan` (the only kind that works end
 *                        to end today — payments are gated off).
 * - `discount_percent` → `value` % off a plan's price at checkout.
 * - `discount_fixed`   → `value` ₮ off a plan's price at checkout.
 */
export type PromoKind = 'free_access' | 'discount_percent' | 'discount_fixed';
export const PROMO_KINDS: PromoKind[] = [
  'free_access',
  'discount_percent',
  'discount_fixed',
];

/** `influencer` = a 7-day trial for influencers/reviewers/partners (task #6). */
export type PromoAudience = 'general' | 'influencer';
export const PROMO_AUDIENCES: PromoAudience[] = ['general', 'influencer'];

/**
 * An admin-managed promo code / campaign (task #5).
 *
 * `usedCount` is a cache of `promo_redemptions` rows, bumped in the SAME
 * statement that checks `usage_limit` — so two people racing for the last use
 * can't both get it (see PromosService.claimUse).
 */
@Entity('promo_codes')
export class PromoCode extends BaseEntity {
  /** Internal campaign name, e.g. "Шинэ жилийн урамшуулал". */
  @Column({ type: 'varchar' })
  name: string;

  /** What the user types. Stored UPPER-CASE; matched case-insensitively. */
  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  kind: PromoKind;

  /** Days (free_access) · percent 1–100 · ₮ amount. */
  @Column({ type: 'int' })
  value: number;

  /** Plan granted (free_access) or discounted (null = any plan). */
  @ManyToOne(() => Plan, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;

  @Column({ name: 'plan_id', type: 'uuid', nullable: true })
  planId: string | null;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  /** Total redemptions allowed; null = unlimited. */
  @Column({ name: 'usage_limit', type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ name: 'used_count', type: 'int', default: 0 })
  usedCount: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', default: 'general' })
  audience: PromoAudience;

  /** Set = only this user may redeem (a code made for one influencer). */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_user_id' })
  assignedUser: User | null;

  @Column({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId: string | null;

  /** Free-text admin note ("@username, Instagram, 2026-10"). */
  @Column({ type: 'text', nullable: true })
  note: string | null;
}
