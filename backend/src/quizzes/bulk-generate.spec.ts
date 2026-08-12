import {
  buildStepBrief,
  buildWordBank,
  dedupKey,
  planSteps,
  questionText,
  recipeFor,
  stepName,
  type BulkStep,
} from './bulk-generate';
import { isListeningCategory } from './ai-generate';

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
    // Зөвхөн гарчгийн мөрийг тоолно — жорын дүрмүүд ч "- "-ээр эхэлдэг.
    const lines = buildStepBrief(step, many)
      .split('\n')
      .filter((l) => l.startsWith('- Гарчиг'));
    expect(lines).toHaveLength(25);
  });

  it('ангиллын дүрмийг даалгаварт оруулна', () => {
    // Энэ л мөрүүд байхгүйгээс "хариулах боломжгүй" дасгал үүсдэг байсан.
    expect(buildStepBrief(step, [])).toContain('СОНСГОЛЫН дасгал');
  });

  it('жоргүй ангилалд нэмэлт дүрэм оруулахгүй (Сорил, IELTS)', () => {
    const soril: BulkStep = {
      category: 'soril',
      label: 'Үг таах',
      topic: null,
      nth: 1,
    };
    expect(buildStepBrief(soril, [])).not.toContain('- ');
  });
});

/**
 * Форматыг AI-д чөлөөтэй сонгуулахад дүрмийн дасгал нь `fill_blank` болж
 * "She ___ to school every day." → `goes` гэсэн ХАРИУЛАХ БОЛОМЖГҮЙ асуулт
 * үүсгэж байв (`walks`/`runs` бүгд зөв мөртлөө тэнцдэггүй). Жор нь үүнийг
 * барьдаг тул тестээр түгжив.
 */
describe('recipeFor', () => {
  it('дүрэм · бичих · сонсгол → multiple_choice (ганц зөв хариулттай)', () => {
    for (const cat of ['grammar', 'writing', 'listening']) {
      expect(recipeFor(cat)?.questionType).toBe('multiple_choice');
    }
  });

  it('нөхөх → fill_blank, гэхдээ үндсэн үгийг хаалтанд өгөхийг шаардана', () => {
    const recipe = recipeFor('fill');
    expect(recipe?.questionType).toBe('fill_blank');
    expect(recipe?.rules.join(' ')).toContain('(go)');
  });

  it('Бичих нь open_response БОЛОХГҮЙ — аппын runner түүнийг харуулдаггүй', () => {
    expect(recipeFor('writing')?.questionType).not.toBe('open_response');
  });

  it('танихгүй ангилалд null (админаас ирсэн төрөл хүчинтэй хэвээр)', () => {
    // Сорилын тоглоом нь өөрийн `quizType`-аар явдаг тул жоргүй.
    expect(recipeFor('soril')).toBeNull();
  });
});

/**
 * IELTS-ийн 4 модуль. Урьд нь жор ОГТ байгаагүй тул ерөнхий prompt рүү унаж,
 * жинхэнэ шалгалтын бүтэцтэй огт төстэй биш контент гардаг байв.
 */
describe('recipeFor — IELTS', () => {
  it('Reading → эх бичвэр шаардана, асуулт түүнээс гарна', () => {
    const r = recipeFor('ielts_reading');
    expect(r?.questionType).toBe('multiple_choice');
    const rules = r!.rules.join(' ');
    expect(rules).toContain('passageText');
    expect(rules).toContain('250–350');
  });

  it('Listening → сонсох бичвэр + нэрээр эхлэх дүрэм', () => {
    const r = recipeFor('ielts_listening');
    expect(r?.questionType).toBe('multiple_choice');
    const rules = r!.rules.join(' ');
    expect(rules).toContain('passageText');
    // Апп бичвэрийг дуугаар уншдаг тул "A:/B:" биш, нэр хэрэгтэй.
    expect(rules).toContain('НЭРЭЭР эхлүүл');
  });

  it('Writing · Speaking → open_response, жишиг хариулт + band тайлбартай', () => {
    for (const cat of ['ielts_writing', 'ielts_speaking']) {
      const r = recipeFor(cat);
      expect(r?.questionType).toBe('open_response');
      expect(r!.rules.join(' ')).toContain('band 7–8');
    }
  });

  it('IELTS Listening нь сонсголын ангилалд тооцогдоно', () => {
    // Үүнгүйгээр апп бичвэрийг уншихгүй, шалгагч ч бичвэр шаардахгүй тул
    // AI-гаар үүсгэсэн IELTS сонсгол хариулах боломжгүй болно.
    expect(isListeningCategory('ielts_listening')).toBe(true);
    expect(isListeningCategory('ielts_reading')).toBe(false);
  });
});

describe('planSteps — жорын төрөл', () => {
  it('жортой ангилалд админы төрлийг ЖОРООРОО дарж бичнэ', () => {
    const steps = planSteps(
      [{ category: 'grammar', label: 'Дүрэм', questionType: 'fill_blank' }],
      1,
    );
    expect(steps[0].questionType).toBe('multiple_choice');
  });

  it('жоргүй ангилалд админы төрөл хэвээр (Сорилын тоглоом)', () => {
    const steps = planSteps(
      [{ category: 'soril', label: 'Холбох', questionType: 'word_match' }],
      1,
    );
    expect(steps[0].questionType).toBe('word_match');
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

/**
 * Цоорхойг ГАРААР бичих нь сурагчид хэт хэцүү байв (зөв санааг олсон ч үсэг
 * алдвал буруу). Сан нь түүнийг "дарж сонгох" болгодог тул зан төлөвийг
 * тестээр түгжив.
 */
describe('buildWordBank', () => {
  const fb = (answer: string) => ({ type: 'fill_blank', answer });

  it('бүх хариултыг нэг санд цуглуулна', () => {
    const bank = buildWordBank([fb('goes'), fb('are'), fb('bought')]);
    expect(bank?.sort()).toEqual(['are', 'bought', 'goes']);
  });

  it('давхардсан хариултыг нэг л удаа оруулна', () => {
    expect(buildWordBank([fb('goes'), fb('goes'), fb('are')])).toHaveLength(2);
  });

  it('нэг л үгтэй бол сан үүсгэхгүй — сонголт нь хариулт өөрөө болно', () => {
    expect(buildWordBank([fb('goes')])).toBeNull();
    expect(buildWordBank([fb('goes'), fb('goes')])).toBeNull();
  });

  it('fill_blank биш дасгалд сан хэрэггүй', () => {
    expect(buildWordBank([{ type: 'multiple_choice', question: 'a' }])).toBeNull();
  });

  it('гэмтсэн/дутуу өгөгдөлд унахгүй', () => {
    expect(buildWordBank([])).toBeNull();
    expect(buildWordBank([null, { type: 'fill_blank' }])).toBeNull();
    expect(buildWordBank([fb('  '), fb('goes'), fb('are')])).toHaveLength(2);
  });
});
