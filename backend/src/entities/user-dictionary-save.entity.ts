import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * A word the user starred (⭐) from the dictionary — search results and the
 * reading-screen tap popover alike.
 *
 * `word` is a plain string, NOT a FK to dictionary_entries, for two reasons:
 * a word tapped in the reader has no dictionary_entries row (that path only
 * touches `translations`), and deleting an entry from the admin Толь page must
 * not break anyone's saved list.
 *
 * This table replaces the old behaviour where saving created a `needs_review`
 * row in the curated `words` bank.
 */
@Entity('user_dictionary_saves')
@Unique('uq_user_dictionary_save', ['userId', 'word'])
export class UserDictionarySave extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Normalised English word (same normalisation as DictionaryEntry.word). */
  @Column()
  word: string;
}
