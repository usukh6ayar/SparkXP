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
    expect(messages(quiz)).toContain('олдсонгүй');
  });

  /*
   * Сонголтот асуултын хариулт өөр үгээр илэрхийлэгдэх нь ХЭВИЙН (жинхэнэ
   * сонсголын шалгалт яг үүн дээр тогтдог) — тиймээс блоклохгүй. Харин
   * асуулт нь ч, хариулт нь ч яриатай холбоогүй бол таамаглахаас өөр арга
   * үлдэхгүй тул блоклоно.
   */
  it('хариулт өөр үгээр илэрхийлэгдсэн ч, асуулт нь яриатай холбоотой бол дамжина', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [
        mc({
          question: 'What does Tom drink after he wakes up?',
          options: ['A hot drink', 'Nothing', 'Two eggs', 'A sandwich'],
          correct: 0,
        }),
      ],
    };
    expect(blocked(quiz)).toBe(false);
  });

  it('асуулт ч, хариулт ч яриан дотор огт байхгүй бол БЛОКЛОНО', () => {
    const quiz = {
      category: 'listening',
      passageText: SCRIPT,
      questions: [
        mc({
          question: 'Which football stadium hosted the final match?',
          options: ['Wembley', 'Anfield', 'Emirates', 'Etihad'],
          correct: 0,
        }),
      ],
    };
    expect(blocked(quiz)).toBe(true);
    expect(messages(quiz)).toContain('таамаглахаас өөр аргагүй');
  });
});

/**
 * ⭐ Сорил хуудсаар үүсгэсэн сонсголын дасгал (`category: 'soril'`, ур чадвар
 * нь `quizType`-д). Урьд нь шалгагч зөвхөн `category`-г хардаг байсан тул
 * эдгээр дасгал сонсгол гэж танигдахгүй, бүх сонсголын шалгалт алгасагдаж,
 * сонсох зүйлгүй «сонсголын» дасгал үүсэх боломжтой байв.
 */
describe('checkQuiz — Сорил хуудасны сонсгол (quizType)', () => {
  it('яриагүй бол блоклоно', () => {
    expect(
      blocked({
        category: 'soril',
        quizType: 'listening',
        questions: [mc()],
      }),
    ).toBe(true);
  });

  it('нөхөх үг яриан дотор байхгүй бол блоклоно', () => {
    expect(
      blocked({
        category: 'soril',
        quizType: 'listening',
        passageText: SCRIPT,
        questions: [
          {
            type: 'fill_blank',
            question: 'Tom eats ___ for breakfast.',
            answer: 'porridge',
          },
        ],
      }),
    ).toBe(true);
  });

  it('сонсголын бус сорил (үг таах) яриа шаардахгүй', () => {
    expect(
      blocked({
        category: 'soril',
        quizType: 'word_guess',
        questions: [
          mc({
            question: 'Which word means "хурдан"?',
            options: ['fast', 'slow', 'big', 'red'],
            correct: 0,
          }),
        ],
      }),
    ).toBe(false);
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

/**
 * Choi-гийн мэдээлсэн худал дохио (2026-08-14): «Мэдээний сонсгол» дасгалын
 * 8 асуултын 4 нь анхааруулга авч, админ өөрийгөө буруу хийсэн гэж бодсон.
 * Шалтгаан нь хариултыг **бүтэн хэллэгээр** тулгадаг байсан явдал.
 */
describe('checkQuiz — сонсголын хариултыг утгын үгээр тулгана', () => {
  const NEWS =
    'Reporter: I am standing beside the library this morning.\n' +
    'A man who lives locally told us the news.\n' +
    'The mayor said he could not wait for the opening.';

  const ask = (
    options: string[],
    correct: number,
    question = 'Where is the reporter?',
  ) => ({
    category: 'listening',
    passageText: NEWS,
    questions: [{ type: 'multiple_choice', question, options, correct }],
  });

  it('өөр угтвартай хариултыг анхааруулахаа больсон («By the library» ↔ «beside the library»)', () => {
    expect(messages(ask(['By the school', 'By the library'], 1))).not.toContain(
      'олдсонгүй',
    );
  });

  it('өөр үгээр илэрхийлсэн хариулт («A local resident» ↔ «lives locally»)', () => {
    expect(
      messages(ask(['A tourist', 'A local resident'], 1, 'Who told the news?')),
    ).not.toContain('олдсонгүй');
  });

  it('яриатай огт холбоогүй хариултыг анхааруулсаар байна', () => {
    expect(
      messages(
        ask(
          ['On television', 'In the newspaper'],
          0,
          'Where did the mayor speak?',
        ),
      ),
    ).toContain('олдсонгүй');
  });

  it('зөвхөн үйлчилгээний үгтэй хариултыг («He is») огт шалгахгүй', () => {
    expect(messages(ask(['He is', 'She is'], 0, 'Who is it?'))).not.toContain(
      'олдсонгүй',
    );
  });

  it('анхааруулга хэвээр — дасгалыг хэзээ ч блоклохгүй', () => {
    expect(
      blocked(
        ask(
          ['On television', 'In the newspaper'],
          0,
          'Where did the mayor speak?',
        ),
      ),
    ).toBe(false);
  });
});

/**
 * Choi, 2026-08-15: «Friday» гэдгийг ХҮНИЙ НЭР гэж үзээд бүтэн Section-ыг
 * блоклосон тул 40 асуулттай шалгалт 30 болж дутуу үүссэн.
 */
describe('checkQuiz — том үсэгтэй ч хүний нэр биш үгс', () => {
  const script =
    'Reception: Good morning, how can I help?\n' +
    'Caller: I would like to book a room for the weekend.';

  const ask = (question: string) => ({
    category: 'listening',
    passageText: script,
    questions: [
      { type: 'multiple_choice', question, options: ['Yes', 'No'], correct: 0 },
    ],
  });

  it.each(['Friday', 'Monday', 'March', 'English', 'University'])(
    '«%s» нь ярианд байхгүй ч БЛОКЛОХГҮЙ',
    (word) => {
      expect(blocked(ask(`Is the room free on ${word}?`))).toBe(false);
    },
  );

  it('жинхэнэ хүний нэр ярианд байхгүй бол блоклосон хэвээр', () => {
    expect(blocked(ask('What time does Sarah arrive?'))).toBe(true);
    expect(messages(ask('What time does Sarah arrive?'))).toContain('Sarah');
  });
});
