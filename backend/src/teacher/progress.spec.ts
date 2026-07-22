import { averageBySkill, SKILL_DIMENSIONS } from './progress.service';

describe('averageBySkill', () => {
  it('averages score_pct per mapped skill and ignores "other"', () => {
    const out = averageBySkill([
      { skill: 'listening', scorePct: 80 },
      { skill: 'listening', scorePct: 60 },
      { skill: 'reading', scorePct: 90 },
      { skill: 'other', scorePct: 10 },
    ]);
    expect(out.listening).toBe(70);
    expect(out.reading).toBe(90);
    expect(out.writing).toBeNull(); // no data → null, not 0
    expect(out.fill).toBeNull();
    expect('other' in out).toBe(false);
  });

  it('lists exactly the four scored dimensions', () => {
    expect(SKILL_DIMENSIONS).toEqual(['listening', 'reading', 'writing', 'fill']);
  });
});
