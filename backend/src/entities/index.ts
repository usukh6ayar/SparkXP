/** Barrel of all entities — import from here when registering with TypeORM. */
import { Organization } from './organization.entity';
import { User } from './user.entity';
import { Plan } from './plan.entity';
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
import { SparksLog } from './sparks-log.entity';
import { LessonUnlock } from './lesson-unlock.entity';
import { Notification } from './notification.entity';
import { ClassJoinRequest } from './class-join-request.entity';
import { AiBuddy } from './ai-buddy.entity';
import { AssignmentCompletion } from './assignment-completion.entity';
import { ReadingPassage } from './reading-passage.entity';
import { Translation } from './translation.entity';
import { Idiom } from './idiom.entity';

export {
  Organization,
  User,
  Plan,
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
  SparksLog,
  LessonUnlock,
  Notification,
  ClassJoinRequest,
  AiBuddy,
  AssignmentCompletion,
  ReadingPassage,
  Translation,
  Idiom,
};

/** Single list to feed TypeORM's `entities` option. */
export const entities = [
  Organization,
  User,
  Plan,
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
  SparksLog,
  LessonUnlock,
  Notification,
  ClassJoinRequest,
  AiBuddy,
  AssignmentCompletion,
  ReadingPassage,
  Translation,
  Idiom,
];
