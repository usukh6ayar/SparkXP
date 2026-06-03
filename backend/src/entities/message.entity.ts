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

  @Column({ type: 'text' })
  content: string;
}
