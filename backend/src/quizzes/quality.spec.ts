import { blockingIssues, checkQuiz, type QuizLike } from './quality';

/**
 * Чанарын шалгагчийн тестүүд. Мөр бүр нь **аппад бодитоор гарч байсан** алдааны
 * хувилбар — тэдгээр дахин орж ирэхээс хамгаална.
 */
const SCRIPT =
  'Sarah: Hi Tom, what time do you usually wake up?\n' +
  'Tom: I usually wake up at seven. Then I drink coffee.\n' +
  'Sarah: That is early!';

/** Тухайн дасгалд `block` төрлийн олдвор байна уу. */
const blocked = (quiz: QuizLike): boolean =>
  blockingIssues(checkQuiz(quiz)).length > 0;

/** Олдворуудын мессежийг нэг мөр болгож, шалгахад хялбар болгоно. */
const messages = (quiz: QuizLike): string =>
  checkQuiz(quiz)
    .map((i) => i.message)
    .join(' | ');

const mc = (extra: Record<string, unknown> = {}) => ({
  type: 'multiple_choice',
  question: 'What time does Tom wake up?',
  options: ['At six', 'At seven', 'At eight', 'At nine'],
  correct: 1,
  ...extra,
});

describe('checkQuiz — сонсгол', () => {
  it('сонсох яриагүй бол блоклоно (бодит алдаа: Сара хэдэд босдог вэ?)', () => {
    expect(blocked({ category: 'listening', questions: [mc()] })).toBe(true);
    expect(messages({ category: 'listening', questions: [mc()] })).toContain(
      'сонсох яриа алга',
    );
  });

  it('бодит бичлэгтэй (IELTS) бол бичвэр шаардахгүй', () => {
    const quiz = {
      category: 'listening',
      audioUrl: 'https://cdn/x.mp3',
      questions: [mc()],
    };
    expect(blocked(quiz)).toBe(false);
  });

  it('асуултад дурдсан нэр яриан дотор байхгүй бол блоклоно', () => {
    // Бодит алдаа: яриа нь "A:"/"B:" гэж явж байхад асуулт нь гэнэт
    // "What time does Sarah start work?" гэж асууж байв.
    const quiz = {
      category: 'listening',
      passageText: 'A: Hi, what time do you start work?\nB: I start at nine.',
      questions: [mc({ question: 'What time does Sarah start work?' })],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('Sarah');
  });

  it('нэр яриан дотор байвал дамжина', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [mc()],
    };
    expect(blocked(quiz)).toBe(false);
  });

  it('нөхөх үг яриан дотор сонсогдохгүй бол БЛОКЛОНО', () => {
    // Бодит алдаа: апп яриаг уншихад нөхөх үг нь тэр яриан дотор огт байхгүй
    // тул сурагч ямар үг байхыг сонсдоггүй байв — таамаглахаас өөр аргагүй.
    // Өгүүлбэр нь яриан дотор БАЙГАА, гэхдээ нөхөх үг нь өөр — яриан дотор
    // «seven» гэсэн байхад «eight» гэж нөхүүлж байна.
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [
        {
          type: 'fill_blank',
          question: 'I usually wake up at ___.',
          answer: 'eight',
        },
      ],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('сонсогдохгүй');
  });

  it('нөхөх үг яриан дотор сонсогдвол дамжина', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [
        {
          type: 'fill_blank',
          question: 'I usually wake up at ___.',
          answer: 'seven',
        },
      ],
    };
    expect(blocked(quiz)).toBe(false);
  });

  it('цоорхойтой өгүүлбэр яриан дотор огт гараагүй бол блоклоно', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [
        {
          type: 'fill_blank',
          question: 'The weather forecast predicts heavy ___ tomorrow.',
          answer: 'seven',
        },
      ],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('яриан дотор гардаггүй');
  });

  it('хариулт яриан дотор сонсогдохгүй бол анхааруулна (блоклохгүй)', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [
        mc({
          question: 'What does Tom drink?',
          options: ['tea', 'juice', 'water', 'milk'],
          correct: 0,
        }),
      ],
    };
    expect(blocked(quiz)).toBe(false);
    expect(messages(quiz)).toContain('шууд сонсогдохгүй');
  });
});

/**
 * ⭐ Аппын сонсох урсгалын БАТАЛГАА.
 *
 * Апп нөхөх дасгалд цоорхойтой өгүүлбэрийг хэзээ ч уншдаггүй — үргэлж ЯРИАнаас
 * уншина (`app/quiz/[id].tsx`). Тэр загвар нь зөвхөн энэ шалгуур биелэх үед л
 * зөв ажиллана: **нөхөх үг бүр яриан дотор сонсогдоно.**
 *
 * Өөрөөр хэлбэл эдгээр тест унавал апп дээр «дуу нь нөхөх үгийг хэлэхгүй»
 * гэсэн алдаа эргэж ирнэ гэсэн үг.
 */
describe('дамжсан сонсголын дасгал бүрийн нөхөх үг ЯРИАнд байна', () => {
  const listeningFill = (answer: string, question: string) => ({
    category: 'listening',
    passageText: SCRIPT,
    questions: [{ type: 'fill_blank', question, answer }],
  });

  it.each([
    ['seven', 'I usually wake up at ___.'],
    ['coffee', 'Then I drink ___.'],
  ])('«%s» яриан дотор байгаа тул дамжина', (answer, question) => {
    expect(blocked(listeningFill(answer, question))).toBe(false);
    // Аппын уншдаг эх сурвалж (яриа) дотор үг нь БАЙХ ёстой — үүн дээр л
    // «чихээрээ барьж авах» дасгал тогтдог.
    expect(SCRIPT.toLowerCase()).toContain(answer.toLowerCase());
  });

  it.each([
    ['eight', 'I usually wake up at ___.'],
    ['tea', 'Then I drink ___.'],
  ])('«%s» яриан дотор байхгүй тул хадгалагдахгүй', (answer, question) => {
    expect(blocked(listeningFill(answer, question))).toBe(true);
  });
});

describe('checkQuiz — fill_blank хоёрдмол хариулт', () => {
  const fill = (extra: Record<string, unknown>) => ({
    category: 'fill',
    questions: [
      {
        type: 'fill_blank',
        question: 'She ___ to school.',
        answer: 'goes',
        ...extra,
      },
    ],
  });

  it('gerund ба infinitive хоёулаа сонголтод байвал блоклоно', () => {
    // `I like ___` → `swimming` ба `to swim` хоёул зөв тул зөв хариулсан
    // сурагч буруу гэж тэмдэглэгддэг байв.
    const quiz = {
      category: 'fill',
      questions: [
        {
          type: 'fill_blank',
          question: 'I like ___ in the sea.',
          answer: 'swimming',
          choices: ['swimming', 'to swim', 'swims', 'swam'],
        },
      ],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('gerund');
  });

  it('зөв хариулт сонголтуудын дунд байхгүй бол блоклоно', () => {
    expect(blocked(fill({ choices: ['go', 'going', 'went', 'gone'] }))).toBe(
      true,
    );
  });

  it('цоорхойгүй бол блоклоно', () => {
    const quiz = {
      category: 'fill',
      questions: [
        { type: 'fill_blank', question: 'She goes to school.', answer: 'goes' },
      ],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('цоорхой алга');
  });

  it('сонголтууд нэг үгийн хэлбэрүүд бол дамжина', () => {
    const quiz = fill({ choices: ['go', 'goes', 'going', 'went'] });
    expect(blocked(quiz)).toBe(false);
    expect(checkQuiz(quiz)).toHaveLength(0);
  });

  it('өөр өөр утгатай сонголт бол анхааруулна (утгаараа сонгох цоорхой)', () => {
    // Бодит жишээ: "My mother likes to ___ in the kitchen." → түлхүүр `cook`,
    // гэтэл `sing` · `eat` · `clean` бүгд адил зөв.
    const quiz = {
      category: 'fill',
      questions: [
        {
          type: 'fill_blank',
          question: 'My mother likes to ___ in the kitchen.',
          answer: 'cook',
          choices: ['cook', 'sing', 'eat', 'clean'],
        },
      ],
    };
    expect(blocked(quiz)).toBe(false);
    expect(messages(quiz)).toContain('нэг үгийн хэлбэрүүд биш');
  });

  it('хаалтанд үндсэн хэлбэр байвал анхааруулахаа болино', () => {
    // "She ___ (go) to school." → зөв хариулт цорын ганц болно.
    const quiz = {
      category: 'fill',
      questions: [
        {
          type: 'fill_blank',
          question: 'She ___ (go) to school every day.',
          answer: 'goes',
          choices: ['goes', 'walks', 'runs', 'drives'],
        },
      ],
    };
    expect(messages(quiz)).not.toContain('нэг үгийн хэлбэрүүд биш');
  });
});

describe('checkQuiz — multiple_choice', () => {
  it('давхардсан сонголтыг блоклоно', () => {
    const quiz = {
      category: 'grammar',
      questions: [mc({ options: ['go', 'goes', 'go', 'going'] })],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('давхардсан');
  });

  it('зөв хариултын дугаар мужаас гарсныг блоклоно', () => {
    expect(
      blocked({ category: 'grammar', questions: [mc({ correct: 7 })] }),
    ).toBe(true);
  });

  it('хариулт асуултын дотор шууд бичигдсэн бол анхааруулна', () => {
    const quiz = {
      category: 'grammar',
      questions: [
        mc({
          question: 'Which word means "at seven"?',
          options: ['At six', 'At seven', 'At eight', 'At nine'],
          correct: 1,
        }),
      ],
    };
    expect(messages(quiz)).toContain('шууд бичигдсэн');
  });
});

describe('checkQuiz — word_match ба ерөнхий', () => {
  it('хоёр үг ижил орчуулгатай бол анхааруулна', () => {
    const quiz = {
      category: 'soril',
      questions: [
        {
          type: 'word_match',
          pairs: [
            { left: 'big', right: 'том' },
            { left: 'large', right: 'том' },
          ],
        },
      ],
    };
    expect(messages(quiz)).toContain('ижил орчуулгатай');
  });

  it('асуултгүй дасгалыг блоклоно', () => {
    expect(blocked({ category: 'grammar', questions: [] })).toBe(true);
  });

  it('нэг дасгал доторх давхардсан асуултыг анхааруулна', () => {
    const quiz = { category: 'grammar', questions: [mc(), mc()] };
    expect(messages(quiz)).toContain('ижил байна');
  });

  it('бүрэн зөв дасгал ямар ч олдворгүй', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [mc()],
    };
    expect(checkQuiz(quiz)).toHaveLength(0);
  });
});
