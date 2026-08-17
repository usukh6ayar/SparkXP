import { canSeeAnswers, stripAnswer, stripAnswers } from './sanitize';

/**
 * Эдгээр нь **аюулгүй байдлын** тестүүд: `GET /quizzes` ба `GET /quizzes/:id`
 * нь Quiz entity-г бүтнээр нь буцаадаг байсан тул сурагч сүлжээний хариунаас
 * дасгал бүрийн зөв хариултыг уншиж чаддаг байв. Дахин орж ирвэл энд баригдана.
 */
describe('stripAnswer', () => {
  it('multiple_choice — `correct` индексийг хасна, `options` үлдээнэ', () => {
    const out = stripAnswer({
      type: 'multiple_choice',
      question: 'What time?',
      options: ['At six', 'At seven'],
      correct: 1,
      points: 10,
    }) as Record<string, unknown>;

    expect(out).not.toHaveProperty('correct');
    expect(out.options).toEqual(['At six', 'At seven']);
    expect(out.points).toBe(10);
  });

  it('fill_blank — `answer`-ыг хасна, `choices` үлдээнэ', () => {
    const out = stripAnswer({
      type: 'fill_blank',
      question: 'He ___ to school.',
      answer: 'goes',
      choices: ['go', 'goes', 'going', 'gone'],
      points: 10,
    }) as Record<string, unknown>;

    expect(out).not.toHaveProperty('answer');
    // Сонголтууд үлдэх ЁСТОЙ — зөв нь дотор нь байх нь дасгалын мөн чанар.
    expect(out.choices).toHaveLength(4);
  });

  it('word_match — хос үлдэнэ, гэхдээ баруун багана холигдоно', () => {
    const pairs = Array.from({ length: 8 }, (_, i) => ({
      left: `left${i}`,
      right: `right${i}`,
    }));
    const out = stripAnswer({ type: 'word_match', pairs, points: 10 }) as {
      pairs: { left: string; right: string }[];
    };

    // Хоёр багана хэвээр бүрэн (апп жагсаалтуудаа эндээс угсардаг).
    expect(out.pairs.map((p) => p.left)).toEqual(pairs.map((p) => p.left));
    expect([...out.pairs.map((p) => p.right)].sort()).toEqual(
      [...pairs.map((p) => p.right)].sort(),
    );
    // 8 элементийн эмх цэгцтэй хэвээр үлдэх магадлал 1/8! — практикт тэг.
    const stillAligned = out.pairs.every((p, i) => p.right === pairs[i].right);
    expect(stillAligned).toBe(false);
  });

  it('open_response — юу ч хасахгүй (жишиг хариулт нь ЗОРИУД харагддаг)', () => {
    const q = {
      type: 'open_response',
      prompt: 'Describe the chart.',
      modelAnswer: 'The chart shows…',
      points: 0,
    };
    expect(stripAnswer(q)).toEqual(q);
  });
});

describe('stripAnswers', () => {
  it('дасгалын бусад талбарыг хөндөхгүй', () => {
    const quiz = {
      id: 'q1',
      title: 'Listening 1',
      wordBank: ['goes', 'runs'],
      questions: [
        { type: 'multiple_choice', options: ['a', 'b'], correct: 0 },
        { type: 'fill_blank', answer: 'goes', choices: ['goes', 'go'] },
      ],
    };
    const out = stripAnswers(quiz);

    expect(out.title).toBe('Listening 1');
    expect(out.wordBank).toEqual(['goes', 'runs']);
    expect(JSON.stringify(out)).not.toContain('"correct"');
    expect(JSON.stringify(out)).not.toContain('"answer"');
  });

  it('асуултгүй дасгалыг унагахгүй', () => {
    expect(
      stripAnswers({ id: 'x' } as { id: string; questions?: unknown[] }),
    ).toEqual({ id: 'x' });
  });
});

describe('canSeeAnswers', () => {
  it('контент засдаг дүрүүд харна', () => {
    expect(canSeeAnswers('admin')).toBe(true);
    expect(canSeeAnswers('super_admin')).toBe(true);
    expect(canSeeAnswers('moderator')).toBe(true);
  });

  it('сурагч ба багш ХАРАХГҮЙ', () => {
    expect(canSeeAnswers('student')).toBe(false);
    expect(canSeeAnswers('teacher')).toBe(false);
    expect(canSeeAnswers(undefined)).toBe(false);
    expect(canSeeAnswers(null)).toBe(false);
  });
});
