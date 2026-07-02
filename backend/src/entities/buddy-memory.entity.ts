import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { BuddyMemoryType } from '../common/enums';
import { User } from './user.entity';

/**
 * A long-term fact the AI Buddy remembers about a user (interests, goals,
 * repeated mistakes, preferences, level). The LLM suggests these; the backend
 * filters + caps them (see BuddyMemoryService). Loaded into the system prompt
 * to personalize replies.
 */
@Entity('buddy_memories')
export class BuddyMemory extends BaseEntity {
  @Index()
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'memory_type', type: 'enum', enum: BuddyMemoryType })
  memoryType: BuddyMemoryType;

  /** The remembered fact, e.g. "User is preparing for IELTS speaking." */
  @Column({ type: 'text' })
  value: string;

  /** Higher = kept longer when the per-user memory cap forces eviction. */
  @Column({ type: 'int', default: 1 })
  importance: number;

  /** The AI message this memory was extracted from (for audit). */
  @Column({ name: 'source_message_id', type: 'uuid', nullable: true })
  sourceMessageId: string | null;

  /** Optional expiry for time-bound facts (e.g. "exam next month"). */
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;
}
