import { LessonsService } from './lessons.service';
import { Lesson } from '../entities/lesson.entity';

/**
 * Бичвэрийн урсгалын аюултай хэсгүүд: (1) хасах нь DB-г устгах ЁСГҮЙ,
 * (2) админы хадгалалт бичвэрийг дарах ЁСГҮЙ, (3) видеогүй бол ойлгомжтой
 * татгалзал. Гуравуулаа чимээгүй өгөгдөл алдагдуулдаг тул тестээр барина.
 */
function makeService(lesson: Partial<Lesson>, sttText = 'Hello world') {
  const saved: Partial<Lesson>[] = [];
  const usages: Record<string, unknown>[] = [];

  const lessons = {
    findOne: async () => lesson as Lesson,
    findAndCount: async () => [[lesson as Lesson], 1] as [Lesson[], number],
    save: async (l: Lesson) => {
      saved.push({ ...l });
      return l;
    },
  };
  const aiUsages = {
    create: (row: Record<string, unknown>) => row,
    save: async (row: Record<string, unknown>) => {
      usages.push(row);
      return row;
    },
  };
  const stt = { transcribeUrl: async () => ({ text: sttText, confidence: 0.9, seconds: 42 }) };
  const xp = { rewards: async () => ({ lesson: 10 }), awardOnce: async () => null };

  const svc = new LessonsService(lessons as never, aiUsages as never, stt as never, xp as never);
  return { svc, saved, usages };
}

const withVideo = (extra: Record<string, unknown> = {}): Partial<Lesson> => ({
  id: 'l1',
  title: 'Present simple',
  content: { videoUrl: 'https://cdn.example.com/a.mp4', imageUrl: 'https://cdn/a.png', ...extra },
});

const storedTranscript = { text: 'stored text', seconds: 42, at: '2026-08-11T00:00:00.000Z' };

describe('LessonsService.transcribe', () => {
  it('rejects a lesson with no video', async () => {
    const { svc } = makeService({ id: 'l1', content: {} });
    await expect(svc.transcribe('l1', 'admin1')).rejects.toThrow('Эхлээд видео оруулна уу');
  });

  it('rejects a video with no speech instead of storing an empty transcript', async () => {
    const { svc, saved } = makeService(withVideo(), '');
    await expect(svc.transcribe('l1', 'admin1')).rejects.toThrow('яриа олдсонгүй');
    expect(saved).toHaveLength(0);
  });

  it('stores the transcript without losing other content keys', async () => {
    const { svc, saved } = makeService(withVideo());
    const result = await svc.transcribe('l1', 'admin1');

    expect(result.text).toBe('Hello world');
    expect(result.seconds).toBe(42);
    expect(saved[0].content).toMatchObject({
      videoUrl: 'https://cdn.example.com/a.mp4',
      imageUrl: 'https://cdn/a.png',
    });
  });

  it('bills the admin, not a student, and says why', async () => {
    const { svc, usages } = makeService(withVideo());
    await svc.transcribe('l1', 'admin1');

    expect(usages[0]).toMatchObject({
      userId: 'admin1',
      voiceSeconds: 42,
      metadata: { purpose: 'lesson_transcript', lessonId: 'l1' },
    });
  });
});

describe('LessonsService — бичвэрийг гадагш гаргахгүй', () => {
  it('strips the transcript from findOne without touching the stored row', async () => {
    const lesson = withVideo({ transcript: storedTranscript });
    const { svc } = makeService(lesson);

    const out = await svc.findOne('l1');

    expect(out.content.transcript).toBeUndefined();
    // Эх мөр хөндөгдөөгүй байх ёстой — эс бөгөөс дараагийн save() устгана.
    expect(lesson.content!.transcript).toEqual(storedTranscript);
  });

  it('strips the transcript from findAll items', async () => {
    const { svc } = makeService(withVideo({ transcript: storedTranscript }));
    const page = await svc.findAll({} as never);
    expect(page.items[0].content.transcript).toBeUndefined();
  });
});

describe('LessonsService.update — бичвэрийн хамгаалалт', () => {
  // ⚠️ Админы форм `content`-оо ЖАГСААЛТЫН хариунаас угсардаг бөгөөд тэнд
  // бичвэр байхгүй. Хамгаалахгүй бол хичээл хадгалах бүрд бичвэр устана.
  it('keeps the stored transcript when the payload omits it', async () => {
    const { svc, saved } = makeService(withVideo({ transcript: storedTranscript }));

    await svc.update('l1', { content: { videoUrl: 'https://cdn.example.com/a.mp4' } } as never);

    expect(saved[0].content!.transcript).toEqual(storedTranscript);
  });

  it('ignores a transcript sent by the client', async () => {
    const { svc, saved } = makeService(withVideo({ transcript: storedTranscript }));

    await svc.update('l1', { content: { transcript: { text: 'forged', seconds: 1, at: 'x' } } } as never);

    expect(saved[0].content!.transcript).toEqual(storedTranscript);
  });

  it('does not return the transcript to the caller', async () => {
    const { svc } = makeService(withVideo({ transcript: storedTranscript }));
    const out = await svc.update('l1', { title: 'Шинэ нэр' } as never);
    expect(out.content.transcript).toBeUndefined();
  });
});
