import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';
import { ReadingPassage } from './reading-passage.entity';

/** Per-user bookmark/progress for reading passages. */
@Entity('reading_progress')
@Index(['userId', 'passageId'], { unique: true })
@Index(['userId', 'updatedAt'])
export class ReadingProgress extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => ReadingPassage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'passage_id' })
  passage: ReadingPassage;

  @Column({ name: 'passage_id', type: 'uuid' })
  passageId: string;

  /** Last sentence index the learner reached. */
  @Column({ name: 'sentence_index', type: 'int', default: 0 })
  sentenceIndex: number;

  /** Set when /reading/:id/complete succeeds; null means in progress. */
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
