import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { PromoCode } from './promo-code.entity';
import { User } from './user.entity';

/**
 * One use of a promo code — the history the admin sees.
 * Unique per (promo, user): a code can never be used twice by the same person.
 */
@Entity('promo_redemptions')
@Unique('uq_promo_redemption_promo_user', ['promoId', 'userId'])
export class PromoRedemption extends BaseEntity {
  @ManyToOne(() => PromoCode, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promo_id' })
  promo: PromoCode;

  @Column({ name: 'promo_id', type: 'uuid' })
  promoId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** free_access: the plan expiry this redemption set. Null for discounts. */
  @Column({ name: 'access_until', type: 'timestamptz', nullable: true })
  accessUntil: Date | null;

  /** discount: the payment it was applied to. */
  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId: string | null;
}
