import {
  buildStepBrief,
  dedupKey,
  planSteps,
  questionText,
  stepName,
  type BulkStep,
} from './bulk-generate';

/**
 * "Бүх төрлөөр үүсгэх"-ийн цөм. Энэ давхарга нь AI дуудахаас ӨМНӨ юу үүсгэхийг
 * шийддэг тул алдаа гарвал 40 дасгал буруу үүснэ — тестээр барих нь хамгийн хямд.
 */
describe('planSteps', () => {
  const listening = {
    category: 'listening',
    label: 'Сонсгол',
    topics: ['Аялал', 'Мэдээ'],
  };

  it('төрөл бүрт хүссэн тоогоор алхам үүсгэнэ', () => {
    const steps = planSteps([listening, { category: 'fill', label: 'Нөхөх' }], 3);
    expect(steps).toHaveLength(6);
    expect(steps.filter((s) => s.category === 'listening')).toHaveLength(3);
  });

  it('сэдвүүд рүү ээлжлүүлж тараана (нэг сэдэв хавдахгүй)', () => {
    const steps = planSteps([listening], 4);
    expect(steps.map((s) => s.topic)).toEqual([
      'Аялал',
      'Мэдээ',
      'Аялал',
      'Мэдээ',
    ]);
  });

  it('сэдэв давтагдах бүрд `nth` өснө — AI-д "өөр өнцгөөр бич" гэж хэлдэг', () => {
    const steps = planSteps([listening], 4);
    expect(steps.map((s) => s.nth)).toEqual([1, 1, 2, 2]);
  });

  it('сэдэвгүй төрөлд topic нь null, nth нь дараалсан тоо', () => {
    // Сорилын тоглоомууд сэдэвгүй — ялгаа нь зөвхөн `nth`.
    const steps = planSteps([{ category: 'soril', label: 'Үг таах' }], 3);
    expect(steps.map((s) => s.topic)).toEqual([null, null, null]);
    expect(steps.map((s) => s.nth)).toEqual([1, 2, 3]);
  });

  it('хоосон/зайтай сэдвийг алгасна', () => {
    const steps = planSteps(
      [{ category: 'fill', label: 'Нөхөх', topics: ['  ', 'Артикль', ''] }],
      2,
    );
    expect(steps.map((s) => s.topic)).toEqual(['Артикль', 'Артикль']);
  });

  it('quizType / contextNote-г алхам бүрт дамжуулна (Сорилд шаардлагатай)', () => {
    const steps = planSteps(
      [
        {
          category: 'soril',
          label: 'Холбох',
          quizType: 'matching',
          contextNote: 'Үг, зургийг холбо',
        },
      ],
      2,
    );
    expect(steps.every((s) => s.quizType === 'matching')).toBe(true);
    expect(steps.every((s) => s.contextNote === 'Үг, зургийг холбо')).toBe(true);
  });
});

describe('dedupKey', () => {
  it('том/жижиг үсэг, цэг таслал, давхар зайг үл тоомсорлоно', () => {
    expect(dedupKey('She ___ to school.')).toBe(dedupKey('she  ___ TO school'));
  });

  it('кирилл үсгийг хадгална (зөвхөн латинаар ажилладаггүй)', () => {
    expect(dedupKey('Аялал жуулчлал!')).toBe('аялал жуулчлал');
  });

  it('өөр асуултыг өөр гэж үзнэ', () => {
    expect(dedupKey('He goes to school')).not.toBe(dedupKey('She goes to work'));
  });
});

describe('questionText', () => {
  it('төрөл бүрээс давхардал шалгах текстийг гаргана', () => {
    expect(questionText({ type: 'multiple_choice', question: 'Where?' })).toBe('Where?');
    expect(questionText({ type: 'fill_blank', question: 'I ___ it' })).toBe('I ___ it');
    expect(questionText({ type: 'open_response', prompt: 'Describe a city' })).toBe(
      'Describe a city',
    );
    expect(
      questionText({
        type: 'word_match',
        pairs: [{ left: 'cat' }, { left: 'dog' }],
      }),
    ).toBe('cat|dog');
  });

  it('гэмтсэн/дутуу өгөгдөлд унахгүй', () => {
    expect(questionText(null)).toBe('');
    expect(questionText({ type: 'word_match' })).toBe('');
    expect(questionText({})).toBe('');
  });
});

describe('buildStepBrief', () => {
  const step: BulkStep = {
    category: 'listening',
    label: 'Сонсгол',
    topic: 'Аялал',
    nth: 1,
  };

  it('сэдвийг даалгаварт оруулна', () => {
    expect(buildStepBrief(step, [])).toContain('Сэдэв: "Аялал"');
  });

  it('эхний дасгалд "өөр өнцгөөр бич" гэж хэлэхгүй', () => {
    expect(buildStepBrief(step, [])).not.toContain('дэх дасгал');
  });

  it('давтагдсан сэдэвт өмнөхөөсөө ялгаатай байхыг шаардана', () => {
    expect(buildStepBrief({ ...step, nth: 3 }, [])).toContain('3 дэх дасгал');
  });

  it('байгаа гарчгуудыг "битгий давт" жагсаалтад оруулна', () => {
    const brief = buildStepBrief(step, ['Аялалын үгс', 'Онгоцны буудал']);
    expect(brief).toContain('- Аялалын үгс');
    expect(brief).toContain('- Онгоцны буудал');
  });

  it('гарчиг хэт олон бол prompt-ыг хязгаарлана (токен хэмнэлт)', () => {
    const many = Array.from({ length: 60 }, (_, i) => `Гарчиг ${i}`);
    const lines = buildStepBrief(step, many)
      .split('\n')
      .filter((l) => l.startsWith('- '));
    expect(lines).toHaveLength(25);
  });
});

describe('stepName', () => {
  it('сэдэвтэй/сэдэвгүй хоёуланд уншигдахуйц нэр өгнө', () => {
    expect(
      stepName({ category: 'l', label: 'Сонсгол', topic: 'Аялал', nth: 2 }),
    ).toBe('Сонсгол · Аялал #2');
    expect(stepName({ category: 's', label: 'Үг таах', topic: null, nth: 1 })).toBe(
      'Үг таах #1',
    );
  });
});
