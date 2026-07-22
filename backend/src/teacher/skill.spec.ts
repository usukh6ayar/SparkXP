import { resolveSkill } from './skill';
import { LessonType } from '../common/enums';

describe('resolveSkill', () => {
  it('uses the category when it is a known skill key', () => {
    expect(resolveSkill('listening', null)).toBe('listening');
    expect(resolveSkill('reading', LessonType.WRITING)).toBe('reading'); // category wins
    expect(resolveSkill('fill', null)).toBe('fill');
  });

  it('falls back to the lesson type when category is a free-text label', () => {
    expect(resolveSkill('Дүрэм', LessonType.WRITING)).toBe('writing');
    expect(resolveSkill('Сонсгол', LessonType.LISTENING)).toBe('listening');
    expect(resolveSkill(null, LessonType.READING)).toBe('reading');
  });

  it('returns "other" when nothing maps', () => {
    expect(resolveSkill('Дүрэм', null)).toBe('other');
    expect(resolveSkill(null, null)).toBe('other');
    expect(resolveSkill('speaking', null)).toBe('other'); // speaking deferred
  });
});
