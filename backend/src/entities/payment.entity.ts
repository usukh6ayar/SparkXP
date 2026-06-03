import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { PaymentStatus } from '../common/enums';
import { User } from './user.entity';
import { Organization } from './organization.entity';

/**
 * A payment record (Phase 2+). Either a user pays for premium or an
 * organization pays for seats — hence both FKs are nullable and the service
 * sets exactly one as the payer.
 *
 * Amounts are stored in integer minor units (e.g. tögrög, or cents) to avoid
 * floating-point money bugs.
 */
@Entity('payments')
export class Payment extends BaseEntity {
  @Index()
  @ManyToOne(() => User, (user) => user.payments, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  /** Amount in minor currency units (integer). */
  @Column({ type: 'int' })
  amount: number;

  /** ISO 4217 code, e.g. "MNT" or "USD". */
  @Column({ default: 'MNT' })
  currency: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  /** Payment gateway name, e.g. "qpay", "stripe". */
  @Column({ type: 'varchar', nullable: true })
  provider: string | null;

  /** Gateway-side transaction id for reconciliation. */
  @Column({ name: 'provider_ref', type: 'varchar', nullable: true })
  providerRef: string | null;

  /** What the payment unlocked (plan, seat count, etc.). */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
