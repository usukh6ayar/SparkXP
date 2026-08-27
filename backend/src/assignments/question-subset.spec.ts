import { BadRequestException } from '@nestjs/common';
import { normalizeIndexes, subsetQuiz } from './question-subset';

describe('normalizeIndexes', () => {
  it('өгөөгүй бол NULL (= бүх асуулт)', () => {
    expect(normalizeIndexes(undefined, 15)).toBeNull();
    expect(normalizeIndexes(null, 15)).toBeNull();
    expect(normalizeIndexes([], 15)).toBeNull();
  });

  it('давхардлыг арилгаж, өсөхөөр эрэмбэлнэ', () => {
    expect(normalizeIndexes([12, 3, 0, 3, 9, 7], 15)).toEqual([0, 3, 7, 9, 12]);
  });

  it('бүгдийг сонгосон бол NULL — дэд олонлог биш', () => {
    expect(normalizeIndexes([2, 0, 1], 3)).toBeNull();
  });

  it('хязгаараас гарсан индексийг татгалзана', () => {
    expect(() => normalizeIndexes([0, 15], 15)).toThrow(BadRequestException);
    expect(() => normalizeIndexes([-1], 15)).toThrow(BadRequestException);
  });

  it('бүхэл бус тоог татгалзана', () => {
    expect(() => normalizeIndexes([1.5], 15)).toThrow(BadRequestException);
  });
});

describe('subsetQuiz', () => {
  const quiz = { id: 'q', questions: ['a', 'b', 'c', 'd', 'e'] };

  it('NULL бол яг тэр объектыг буцаана (хуулбарлахгүй)', () => {
    expect(subsetQuiz(quiz, null)).toBe(quiz);
  });

  it('зөвхөн сонгосон асуултуудыг өгсөн дарааллаар үлдээнэ', () => {
    expect(subsetQuiz(quiz, [0, 2, 4]).questions).toEqual(['a', 'c', 'e']);
  });

  it('эх quiz-ийг өөрчлөхгүй', () => {
    subsetQuiz(quiz, [1]);
    expect(quiz.questions).toHaveLength(5);
  });

  it('дараа нь устсан асуултыг алгасна', () => {
    expect(subsetQuiz(quiz, [1, 9, 20]).questions).toEqual(['b']);
  });

  it('нэг ч үлдэхгүй бол бүтэн тестийг буцаана (хоосон дасгал өгөхгүй)', () => {
    expect(subsetQuiz(quiz, [7, 8]).questions).toHaveLength(5);
  });
});
