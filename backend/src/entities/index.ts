/** Barrel of all entities — import from here when registering with TypeORM. */
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { ClassEntity } from './class.entity';
import { Lesson } from './lesson.entity';
import { Word } from './word.entity';
import { Quiz } from './quiz.entity';
import { Assignment } from './assignment.entity';
import { WordReview } from './word-review.entity';
import { XpLog } from './xp-log.entity';
import { AiUsage } from './ai-usage.entity';
import { Message } from './message.entity';
import { Payment } from './payment.entity';

export {
  Organization,
  User,
  ClassEntity,
  Lesson,
  Word,
  Quiz,
  Assignment,
  WordReview,
  XpLog,
  AiUsage,
  Message,
  Payment,
};

/** Single list to feed TypeORM's `entities` option. */
export const entities = [
  Organization,
  User,
  ClassEntity,
  Lesson,
  Word,
  Quiz,
  Assignment,
  WordReview,
  XpLog,
  AiUsage,
  Message,
  Payment,
];
