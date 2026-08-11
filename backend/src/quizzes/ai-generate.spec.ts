import {
  buildPrompt,
  MAX_LESSON_SOURCE_CHARS,
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
