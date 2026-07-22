import { LessonType } from '../common/enums';

/** The four scored skill dimensions (Speaking deferred). `other` = unmapped. */
export type Skill = 'listening' | 'reading' | 'writing' | 'fill' | 'other';

const SKILL_KEYS: Skill[] = ['listening', 'reading', 'writing', 'fill'];

/**
 * Normalize a quiz to a canonical skill dimension for the teacher breakdown.
 * `quiz.category` is free text (a Дасгал holds the skill key; a lesson-linked
 * quiz may hold a Mongolian label), so we trust the category only when it is
 * itself a skill key, else fall back to the parent lesson's type.
 */
export function resolveSkill(
  category: string | null,
  lessonType: LessonType | null,
): Skill {
  if (category && (SKILL_KEYS as string[]).includes(category)) {
    return category as Skill;
  }
  if (lessonType && (SKILL_KEYS as string[]).includes(lessonType)) {
    return lessonType as unknown as Skill;
  }
  return 'other';
}
