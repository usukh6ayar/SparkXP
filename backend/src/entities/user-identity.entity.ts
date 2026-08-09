import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { AuthProvider } from '../common/enums';

/**
 * A third-party sign-in linked to a SparkXP account (Google, Apple).
 *
 * Its own table rather than `google_id`/`apple_id` columns on `users`, so one
 * account can hold several providers — the normal case here, since Apple hides
 * the address behind a private relay and the same person may also use Google.
 *
 * The unique key is (provider, provider_user_id): the provider's `sub` claim,
 * which is stable for the lifetime of the account and, unlike the email, cannot
 * be changed by the user. **Never key on email** — an address can be reassigned
 * by a mail admin, and Apple's relay addresses differ per app.
 */
@Entity('user_identities')
@Unique('UQ_user_identity_provider_sub', ['provider', 'providerUserId'])
export class UserIdentity extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 16 })
  provider: AuthProvider;

  /** The provider's stable subject id (`sub`), NOT the email. */
  @Column({ name: 'provider_user_id', type: 'varchar' })
  providerUserId: string;

  /**
   * Address the provider reported at link time, kept for support ("which
   * account is this?"). Not authoritative and never used for lookup — Apple
   * only sends it on the very first authorisation.
   */
  @Column({ name: 'provider_email', type: 'varchar', nullable: true })
  providerEmail: string | null;
}
