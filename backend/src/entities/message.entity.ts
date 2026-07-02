import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { MessageRole } from '../common/enums';
import { User } from './user.entity';

/**
 * A single chat turn in an AI buddy conversation. Messages sharing a
 * `conversationId` form one thread; ordering is by `createdAt`.
 *
 * Stored so we can replay context to the model and show history in the app.
 */
@Entity('messages')
export class Message extends BaseEntity {
  @Index()
  @ManyToOne(() => User, (user) => user.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Groups messages into a thread. Indexed for fast history loads. */
  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @Column({ type: 'enum', enum: MessageRole })
  role: MessageRole;

  /** Display text: AI reply, or the (cleaned) user transcript shown in the UI. */
  @Column({ type: 'text' })
  content: string;

  // --- AI Buddy voice fields (null for plain text-chat rows) ---

  /** Links a turn to its BuddySession. Indexed for fast history loads. */
  @Index()
  @Column({ name: 'session_id', type: 'uuid', nullable: true })
  sessionId: string | null;

  @Column({ name: 'buddy_slug', type: 'varchar', nullable: true })
  buddySlug: string | null;

  /** Cloudinary URL of the spoken audio for this turn. */
  @Column({ name: 'audio_url', type: 'varchar', nullable: true })
  audioUrl: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  /**
   * Raw, UNCORRECTED STT transcript for user turns. Kept separate from
   * `content` because the user's mistakes are the input for corrections and
   * must never be grammar-cleaned before reaching the LLM (docx §6).
   */
  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string | null;

  /**
   * Structured turn extras for AI turns: correction, follow_up_question,
   * emotion, gesture, cefr_level_used. One jsonb column keeps the schema flat.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;
}
