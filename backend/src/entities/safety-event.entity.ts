import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * Audit trail for AI Buddy safety incidents: LLM-flagged output, blocked
 * topics, rate-limit hits, jailbreak attempts. Searchable from the admin panel
 * (docx §13) without exposing private message contents beyond `details`.
 */
@Entity('safety_events')
export class SafetyEvent extends BaseEntity {
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  /** e.g. "llm_flagged", "blocked_topic", "rate_limited", "jailbreak_attempt". */
  @Column({ name: 'event_type', type: 'varchar' })
  eventType: string;

  @Column({ type: 'varchar', default: 'low' })
  severity: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;
}
