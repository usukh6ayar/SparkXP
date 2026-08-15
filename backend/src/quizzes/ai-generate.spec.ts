import {
  buildPrompt,
  buildSchema,
  MAX_LESSON_SOURCE_CHARS,
  MIN_LISTENING_SCRIPT,
  parseDraft,
  type GenerateOptions,
} from './ai-generate';

const base: GenerateOptions = { brief: 'Present simple дасгал', kind: 'lesson' };

describe('buildPrompt lessonSource', () => {
  it('includes the lesson transcript as its own labelled block', () => {
    const prompt = buildPrompt({ ...base, lessonSource: 'Өнөөдөр бид present simple үзнэ. I go to school.' });

    expect(prompt).toContain('ХИЧЭЭЛИЙН АГУУЛГА (видеоны бичвэр)');
    expect(prompt).toContain('I go to school.');
  });

  it('tells the model the transcript is mixed-language and machine-made', () => {
    const prompt = buildPrompt({ ...base, lessonSource: 'ямар нэг бичвэр' });

    // Үгчлэн биш — санааг нь шалгана: буруу бичигдсэн монгол текстийг
    // "алдаа" гэж үзэж, англи асуулт үүсгэхээ болихоос сэргийлнэ.
    expect(prompt).toContain('автомат');
    expect(prompt).toContain('англиар');
  });

  it('truncates a very long transcript', () => {
    const long = 'a'.repeat(MAX_LESSON_SOURCE_CHARS + 5000);
    const prompt = buildPrompt({ ...base, lessonSource: long });

    expect(prompt).not.toContain('a'.repeat(MAX_LESSON_SOURCE_CHARS + 1));
    expect(prompt).toContain('a'.repeat(MAX_LESSON_SOURCE_CHARS));
  });

  it('omits the block entirely when there is no transcript', () => {
    expect(buildPrompt(base)).not.toContain('ХИЧЭЭЛИЙН АГУУЛГА');
  });

  it('omits the block when the transcript is only whitespace', () => {
    const prompt = buildPrompt({ ...base, lessonSource: '   \n  ' });
    expect(prompt).not.toContain('ХИЧЭЭЛИЙН АГУУЛГА');
    // Блокгүй үед "доорх бичвэр" гэсэн заавар ч гарах ёсгүй — эс бөгөөс
    // загварт байхгүй материалыг заана.
    expect(prompt).not.toContain('Доорх бичвэр');
  });
});

/**
 * Сонсголын дасгал ХАРИУЛАХ БОЛОМЖТОЙ байх баталгаа.
 *
 * Бодит алдаа: "Өдөр тутмын ярианы сонсгол" гэсэн дасгал шууд
 * "What time does Sarah usually wake up?" гэж асууж, Сара хэдэд босдог тухай
 * хаана ч дурдаагүй байв — сурагчид таамаглахаас өөр арга үлдээгүй.
 *
 * Шалтгаан нь ганцаарчилсан "AI-аар үүсгэх" зам ангиллын жорыг уншдаггүй
 * байсан: загварт "listening" гэдгийг зөвхөн шошго болгож дамжуулж, сонсох
 * ЯРИА зохиох даалгавар өгдөггүй байлаа.
 */
const listeningOptions = (
  extra: Partial<GenerateOptions> = {},
): GenerateOptions => ({
  brief: 'Өдөр тутмын яриа',
  kind: 'exercise',
  category: 'listening',
  count: 3,
  ...extra,
});

/** Сонсоход хангалттай урт, бодит яриа. */
const SCRIPT =
  'A: Hi Sarah, you look tired.\nB: I woke up at half past six today.\nA: That is early!';

const mcQuestion = (question: string) => ({
  type: 'multiple_choice',
  question,
  options: ['6:30', '7:30', '8:00', '9:00'],
  correct: 0,
});

describe('buildPrompt — сонсголын жор', () => {
  it('сонсох яриа зохиох даалгаврыг prompt-д оруулна', () => {
    const prompt = buildPrompt(listeningOptions());
    expect(prompt).toContain('passageText');
    expect(prompt).toContain('СОНСГОЛЫН дасгал');
  });

  it('хариулт нь яриан дотор байх ёстойг шаардана', () => {
    // Энэ мөр байхгүй бол загвар яриа зохиогоод ч түүнд хамаагүй асуулт
    // бичиж чадна — тэгвэл асуудал яг хэвээрээ үлдэнэ.
    expect(buildPrompt(listeningOptions())).toContain('ШУУД сонсогдож байх');
  });

  it('ярианы оролцогчийг нэрээр бичүүлнэ (A:/B: хориглоно)', () => {
    // "A:"/"B:" гэж бичүүлэхэд загвар асуултдаа гэнэт нэр зохиож оруулдаг байв:
    // "What time does Sarah start work?" — гэтэл яриан дотор Sarah гэж хэн ч алга.
    const prompt = buildPrompt(listeningOptions());
    expect(prompt).toContain('НЭРЭЭР эхлүүл');
    expect(prompt).toContain('яриан дотор ЗААВАЛ сонсогдсон байх');
  });

  it('админ яриаг өөрөө өгсөн бол ЗӨВХӨН түүн дээр үндэслэнэ', () => {
    const prompt = buildPrompt(listeningOptions({ passageText: SCRIPT }));
    expect(prompt).toContain(SCRIPT);
    expect(prompt).toContain('ЗӨВХӨН дараах яриан дээр үндэслэ');
  });

  it('сонсгол БИШ ангилалд яриа шаардахгүй', () => {
    const prompt = buildPrompt({
      brief: 'Цаг',
      kind: 'exercise',
      category: 'grammar',
    });
    expect(prompt).not.toContain('passageText');
  });
});

describe('buildSchema — сонсголд яриа заавал', () => {
  it('сонсголд `passageText` нь required', () => {
    const schema = buildSchema(listeningOptions(), 'multiple_choice') as {
      required: string[];
      properties: { passageText: { minLength?: number } };
    };
    expect(schema.required).toContain('passageText');
    expect(schema.properties.passageText.minLength).toBe(MIN_LISTENING_SCRIPT);
  });

  it('бусад ангилалд `passageText` сонголттой хэвээр', () => {
    const schema = buildSchema(
      { brief: 'Цаг', kind: 'exercise', category: 'grammar' },
      'multiple_choice',
    ) as { required: string[] };
    expect(schema.required).not.toContain('passageText');
  });
});

describe('parseDraft — яриагүй сонсгол хадгалагдахгүй', () => {
  const draft = (extra: Record<string, unknown>) =>
    JSON.stringify({
      title: 'Өдөр тутмын яриа',
      level: 'a1',
      questionType: 'multiple_choice',
      questions: [mcQuestion('What time does Sarah wake up?')],
      ...extra,
    });

  it('яриагүй бол алдаа шиднэ (бодит алдааны хувилбар)', () => {
    expect(() => parseDraft(draft({}), listeningOptions())).toThrow(
      /сонсох яриа/,
    );
  });

  it('яриа нь хэт богино бол мөн алдаа шиднэ', () => {
    expect(() =>
      parseDraft(draft({ passageText: 'Hi.' }), listeningOptions()),
    ).toThrow(/сонсох яриа/);
  });

  it('бүрэн яриатай бол дамжина', () => {
    const parsed = parseDraft(
      draft({ passageText: SCRIPT }),
      listeningOptions(),
    );
    expect(parsed.passageText).toBe(SCRIPT);
    expect(parsed.questions).toHaveLength(1);
  });

  it('админы өгсөн яриаг AI буцаагаагүй ч хүлээн авна', () => {
    const parsed = parseDraft(
      draft({}),
      listeningOptions({ passageText: SCRIPT }),
    );
    expect(parsed.passageText).toBe(SCRIPT);
  });

  it('сонсгол БИШ дасгал яриагүйгээр хэвийн дамжина', () => {
    const parsed = parseDraft(draft({}), {
      brief: 'Цаг',
      kind: 'exercise',
      category: 'grammar',
      count: 1,
    });
    expect(parsed.passageText).toBeNull();
  });
});
