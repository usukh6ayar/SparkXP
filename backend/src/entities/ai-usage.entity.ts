import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { AiUsageType } from '../common/enums';
import { User } from './user.entity';

/**
 * One row per AI call, written by the central AI Gateway (CLAUDE.md: all AI
 * calls go through one module). Powers per-user limits, cost tracking, and
 * logging. Features must never call AI APIs directly, so this is the only
 * place usage is recorded.
 */
@Entity('ai_usages')
export class AiUsage extends BaseEntity {
  @Index()
  @ManyToOne(() => User, (user) => user.aiUsages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: AiUsageType })
  type: AiUsageType;

  /** Provider model identifier, e.g. "claude-haiku-4-5". */
  @Column({ type: 'varchar', nullable: true })
  model: string | null;

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  /** Voice seconds consumed (STT/TTS); 0 for text calls. */
  @Column({ name: 'voice_seconds', type: 'int', default: 0 })
  voiceSeconds: number;

  /** Estimated cost in micro-USD (integer to avoid float drift). */
  @Column({ name: 'cost_micro_usd', type: 'int', default: 0 })
  costMicroUsd: number;

  /** Raw request/response context for debugging and audits. */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
