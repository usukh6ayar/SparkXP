import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * A purchasable AI Buddy background (the scene behind the buddy on the voice /
 * chat stage). Admin-authored and DB-driven — the app never hardcodes the
 * catalog. Bought with Sparks (the spendable currency; XP is never spent, so
 * leaderboards stay intact). A background can be time-boxed (seasonal) and
 * toggled without deleting.
 */
@Entity('buddy_backgrounds')
export class BuddyBackground extends BaseEntity {
  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Scene image (Cloudinary/R2 URL). Shown as the preview and, once equipped,
   *  behind the buddy. */
  @Column({ name: 'image_url', type: 'varchar' })
  imageUrl: string;

  /** Sparks price. 0 = free (still must be acquired to equip). */
  @Column({ name: 'price_sparks', type: 'int', default: 0 })
  priceSparks: number;

  /** Premium-plan exclusive — locked for free users regardless of Sparks. */
  @Column({ name: 'is_premium', type: 'boolean', default: false })
  isPremium: boolean;

  /** Optional seasonal window: only purchasable while `now` is inside it. */
  @Column({ name: 'seasonal_start', type: 'timestamptz', nullable: true })
  seasonalStart: Date | null;

  @Column({ name: 'seasonal_end', type: 'timestamptz', nullable: true })
  seasonalEnd: Date | null;

  /** Admin off-switch — hidden from the shop when false. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Sort order in the shop (low → first). */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
