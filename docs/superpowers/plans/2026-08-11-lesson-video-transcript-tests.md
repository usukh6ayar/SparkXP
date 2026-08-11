# Видеоноос хичээлийн тест үүсгэх — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Хичээлийн видеог ElevenLabs Scribe-аар бичвэр болгож, засах боломжтой байдлаар хадгалаад, одоо байгаа AI тест генератор руу контекст болгон дамжуулна.

**Architecture:** Гурван давхарга. (1) `SttAdapter`-т `transcribeUrl()` нэмнэ — ElevenLabs-ийн `source_url` талбарыг ашиглах тул видео Railway-гийн санах ойгоор дамжихгүй. (2) Транскрипт нь `lesson.content.transcript`-д **серверийн эзэмшилтэй** талбар болж сууна: аппын хариунаас хасагдана, `PATCH /lessons/:id`-аар дарагдахаас хамгаалагдана, өөрийн 3 route-тай. (3) `ai-generate.ts`-ийн prompt-д `lessonSource` блок нэмэгдэж, одоо байгаа `AiBulkGenerator` түүнийг дамжуулна.

**Tech Stack:** NestJS + TypeORM (backend), Vite + React (admin), Jest (тест), ElevenLabs Scribe (STT), Google Gemini (генератор — хөндөгдөхгүй).

**Spec:** `docs/superpowers/specs/2026-08-11-lesson-video-transcript-tests-design.md`

**Салбар:** `usukhbayar` (аль хэдийн шилжсэн, `origin/main` татсан).

---

## Файлын бүтэц

| Файл | Үүрэг |
| --- | --- |
| `backend/src/ai-gateway/providers/stt.adapter.ts` | **Засах.** `transcribeUrl()` нэмнэ. |
| `backend/src/lessons/lesson-transcript.ts` | **Шинэ.** Транскриптийн цэвэр функцууд (DB/сүлжээгүй) — уншиж, merge хийж, хасаж, хамгаална. |
| `backend/src/lessons/lesson-transcript.spec.ts` | **Шинэ.** Дээрхийн тест. |
| `backend/src/lessons/lessons.service.ts` | **Засах.** `transcribe()` · `getTranscript()` · `saveTranscript()`; `findAll`/`findOne`-оос хасах; `update()`-ийг хамгаалах. |
| `backend/src/lessons/lessons.controller.ts` | **Засах.** 3 админ route. |
| `backend/src/lessons/lessons.module.ts` | **Засах.** `AiGatewayModule` + `AiUsage` repo. |
| `backend/src/lessons/dto/update-transcript.dto.ts` | **Шинэ.** `{ text }` DTO. |
| `backend/src/quizzes/ai-generate.ts` | **Засах.** `lessonSource` → prompt блок. |
| `backend/src/quizzes/ai-generate.spec.ts` | **Шинэ.** Prompt-ийн тест. |
| `backend/src/quizzes/dto/ai-generate-quiz.dto.ts` | **Засах.** `lessonSource` талбар. |
| `admin/src/pages/lessons/LessonsPage.tsx` | **Засах.** Бичвэрийн товч + textarea. |
| `admin/src/pages/lessons/LessonTests.tsx` | **Засах.** `transcript` prop → `lessonSource`. |
| `admin/src/components/AiBulkGenerator.tsx` | **Засах.** `AiTarget.lessonSource` → хүсэлт. |

Цэвэр функцууд `lesson-transcript.ts`-д тусад нь сууж байгаа шалтгаан: тэдгээр нь DB, сүлжээ, Nest DI-гүйгээр бүрэн тестлэгдэнэ. `lessons.service.ts` нь зөвхөн эдгээрийг залгах болно.

---

## Task 1: `transcribeUrl` — URL-ээр хөрвүүлэх

**Files:**
- Modify: `backend/src/ai-gateway/providers/stt.adapter.ts`
- Test: `backend/src/ai-gateway/providers/stt-url.spec.ts` (шинэ)

- [ ] **Step 1: Тест бич (унах ёстой)**

Шинэ файл `backend/src/ai-gateway/providers/stt-url.spec.ts`:

```ts
import { ConfigService } from '@nestjs/config';
import { ElevenLabsSttAdapter } from './stt.adapter';

/**
 * `transcribeUrl` нь видеог татаж авалгүй ElevenLabs-д URL өгдөг — энэ нь
 * 200MB видеог Railway-гийн санах ойд оруулахаас сэргийлдэг гол шийдвэр.
 * Мөн хичээлийн видео **холимог хэлтэй** (монгол тайлбар + англи жишээ) тул
 * `language_code` илгээх ЁСГҮЙ — тэгвэл Scribe нэг хэл рүү шахна.
 */
describe('ElevenLabsSttAdapter.transcribeUrl', () => {
  const config = { get: (k: string, d?: string) => (k === 'ELEVENLABS_API_KEY' ? 'test-key' : d) } as ConfigService;

  afterEach(() => jest.restoreAllMocks());

  it('sends source_url and no language_code', async () => {
    let sentBody: FormData | undefined;
    jest.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      sentBody = init?.body as FormData;
      return Promise.resolve(
        new Response(
          JSON.stringify({ text: '  Hello world  ', language_probability: 0.9, words: [{ end: 12.2 }] }),
          { status: 200 },
        ),
      );
    });

    const adapter = new ElevenLabsSttAdapter(config);
    const result = await adapter.transcribeUrl('https://cdn.example.com/lesson.mp4');

    expect(sentBody?.get('source_url')).toBe('https://cdn.example.com/lesson.mp4');
    expect(sentBody?.get('language_code')).toBeNull();
    expect(sentBody?.get('file')).toBeNull();
    expect(result.text).toBe('Hello world');
    expect(result.seconds).toBe(13); // Math.ceil(12.2)
  });

  it('throws a Mongolian error when the API rejects the request', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 400 }));
    const adapter = new ElevenLabsSttAdapter(config);
    await expect(adapter.transcribeUrl('https://cdn.example.com/x.mp4')).rejects.toThrow(
      'Видеоны яриаг таньж чадсангүй',
    );
  });
});
```

- [ ] **Step 2: Тест унаж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/ai-gateway/providers/stt-url.spec.ts`
Expected: FAIL — `adapter.transcribeUrl is not a function`

- [ ] **Step 3: Interface-д метод нэмэх**

`backend/src/ai-gateway/providers/stt.adapter.ts` дотор `SttAdapter` interface-ийг солино:

```ts
/** Audio → text. The single seam for swapping STT providers. */
export interface SttAdapter {
  transcribe(audio: Buffer, mime: string): Promise<SttResult>;
  /**
   * Same thing, but the provider fetches the media itself from a public URL.
   * Used for lesson videos: a 200MB upload must never be pulled into this
   * process just to be forwarded.
   */
  transcribeUrl(url: string): Promise<SttResult>;
}
```

- [ ] **Step 4: Хэрэгжүүлэлт бичих**

`ElevenLabsSttAdapter` дотор, одоо байгаа `transcribe()`-ийн ард нэмнэ. Хариу задлах хэсэг хоёуланд ижил тул тусад нь гаргана:

```ts
  /**
   * URL-ээр хөрвүүлэх. ElevenLabs өөрөө татаж авдаг тул видео энэ процессоор
   * дамжихгүй (хичээлийн видео 200MB хүртэл байж болно).
   *
   * ⚠️ `language_code` ЗОРИУД өгөхгүй: хичээлийн видео холимог хэлтэй
   * (монголоор тайлбарлаад англи жишээ), нэг хэл зааж өгвөл Scribe нөгөөг нь
   * гуйвуулж бичдэг.
   */
  async transcribeUrl(url: string): Promise<SttResult> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ELEVENLABS_API_KEY тохируулаагүй байна');
    }

    let lastStatus = 0;
    for (let attempt = 0; attempt < 2; attempt++) {
      const form = new FormData();
      form.append('model_id', SCRIBE_MODEL);
      form.append('source_url', url);

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        body: form,
      });

      if (response.ok) return parseSttResponse(await response.json());

      lastStatus = response.status;
      if (response.status < 500) break; // client error → don't retry
      await sleep(1000);
    }

    this.logger.error(`ElevenLabs STT (url) failed (${lastStatus})`);
    throw new InternalServerErrorException('Видеоны яриаг таньж чадсангүй');
  }
```

Мөн файлын дээд талд, класын гадна нэмнэ:

```ts
/** Scribe-ийн JSON хариуг {@link SttResult} болгоно (хоёр метод хуваалцана). */
function parseSttResponse(raw: unknown): SttResult {
  const data = (raw ?? {}) as {
    text?: string;
    language_probability?: number;
    words?: { end?: number }[];
  };
  const words = data.words ?? [];
  return {
    text: (data.text ?? '').trim(),
    confidence: data.language_probability ?? 1,
    seconds: words.length ? Math.ceil(words[words.length - 1].end ?? 0) : 0,
  };
}
```

Одоо байгаа `transcribe()`-ийн `if (response.ok) { ... }` блокийг мөн
`if (response.ok) return parseSttResponse(await response.json());` болгож
солино (давхардал арилна — CODING_RULES §0.2).

- [ ] **Step 5: Тест давж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/ai-gateway/providers/stt-url.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/ai-gateway/providers/stt.adapter.ts backend/src/ai-gateway/providers/stt-url.spec.ts
git commit -m "feat(stt): URL-ээр хөрвүүлэх transcribeUrl нэмэв

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Транскриптийн цэвэр функцууд

**Files:**
- Create: `backend/src/lessons/lesson-transcript.ts`
- Test: `backend/src/lessons/lesson-transcript.spec.ts`

- [ ] **Step 1: Тест бич (унах ёстой)**

Шинэ файл `backend/src/lessons/lesson-transcript.spec.ts`:

```ts
import {
  readTranscript,
  readVideoUrl,
  withTranscript,
  stripTranscript,
  preserveTranscript,
} from './lesson-transcript';

describe('readVideoUrl', () => {
  it('reads content.videoUrl', () => {
    expect(readVideoUrl({ videoUrl: 'https://x/a.mp4' })).toBe('https://x/a.mp4');
  });

  it('returns null when missing or not a string', () => {
    expect(readVideoUrl({})).toBeNull();
    expect(readVideoUrl({ videoUrl: '' })).toBeNull();
    expect(readVideoUrl({ videoUrl: 42 })).toBeNull();
  });
});

describe('readTranscript', () => {
  it('reads a stored transcript', () => {
    const t = { text: 'hello', seconds: 12, at: '2026-08-11T00:00:00.000Z' };
    expect(readTranscript({ transcript: t })).toEqual(t);
  });

  it('returns null when absent or malformed', () => {
    expect(readTranscript({})).toBeNull();
    expect(readTranscript({ transcript: 'oops' })).toBeNull();
    expect(readTranscript({ transcript: { seconds: 1 } })).toBeNull();
  });
});

describe('withTranscript', () => {
  it('keeps every other content key', () => {
    const before = { videoUrl: 'https://x/a.mp4', imageUrl: 'https://x/a.png', topic: 'greetings' };
    const after = withTranscript(before, { text: 'hi', seconds: 5, at: 'now' });

    expect(after.videoUrl).toBe('https://x/a.mp4');
    expect(after.imageUrl).toBe('https://x/a.png');
    expect(after.topic).toBe('greetings');
    expect(after.transcript).toEqual({ text: 'hi', seconds: 5, at: 'now' });
  });

  it('does not mutate the input', () => {
    const before = { videoUrl: 'https://x/a.mp4' };
    withTranscript(before, { text: 'hi', seconds: 5, at: 'now' });
    expect(before).toEqual({ videoUrl: 'https://x/a.mp4' });
  });
});

describe('stripTranscript', () => {
  it('removes only the transcript', () => {
    const out = stripTranscript({ videoUrl: 'v', transcript: { text: 'hi', seconds: 1, at: 'now' } });
    expect(out).toEqual({ videoUrl: 'v' });
  });

  it('does not mutate the input', () => {
    const before = { transcript: { text: 'hi', seconds: 1, at: 'now' } };
    stripTranscript(before);
    expect(before.transcript).toBeDefined();
  });

  it('is safe on empty content', () => {
    expect(stripTranscript({})).toEqual({});
  });
});

describe('preserveTranscript', () => {
  // ⚠️ Энэ бол гол хамгаалалт. Админы форм `content`-оо ЖАГСААЛТЫН хариунаас
  // угсардаг (LessonsPage.tsx), тэр хариунд транскрипт байхгүй — тиймээс
  // хамгаалахгүй бол хичээл хадгалах бүрд транскрипт устана.
  it('restores the stored transcript when the payload omits it', () => {
    const stored = { videoUrl: 'v', transcript: { text: 'hi', seconds: 1, at: 'now' } };
    const incoming = { videoUrl: 'v', imageUrl: 'i' };

    const out = preserveTranscript(stored, incoming);

    expect(out.transcript).toEqual({ text: 'hi', seconds: 1, at: 'now' });
    expect(out.imageUrl).toBe('i');
  });

  it('ignores a transcript sent by the client', () => {
    const stored = { transcript: { text: 'real', seconds: 1, at: 'now' } };
    const incoming = { transcript: { text: 'forged', seconds: 999, at: 'then' } };

    expect(preserveTranscript(stored, incoming).transcript).toEqual({
      text: 'real', seconds: 1, at: 'now',
    });
  });

  it('leaves the payload alone when nothing is stored', () => {
    expect(preserveTranscript({ videoUrl: 'v' }, { imageUrl: 'i' })).toEqual({ imageUrl: 'i' });
  });
});
```

- [ ] **Step 2: Тест унаж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/lessons/lesson-transcript.spec.ts`
Expected: FAIL — `Cannot find module './lesson-transcript'`

- [ ] **Step 3: Хэрэгжүүлэлт бичих**

Шинэ файл `backend/src/lessons/lesson-transcript.ts`:

```ts
/**
 * Хичээлийн видеоны бичвэр (транскрипт) — `lesson.content.transcript`.
 *
 * Энэ бол **серверийн эзэмшилтэй** талбар: админы форм `content`-оо
 * жагсаалтын хариунаас угсардаг бөгөөд тэр хариунаас транскрипт хасагддаг тул,
 * хамгаалахгүй бол хичээл хадгалах бүрд устана. Тиймээс бичих цорын ганц зам
 * нь `/lessons/:id/transcribe` ба `/lessons/:id/transcript`.
 *
 * Энд зөвхөн цэвэр функцууд байна (DB/сүлжээгүй) — тусад нь тестлэгдэнэ.
 */

/** Хадгалагдсан бичвэр. `at` = ISO огноо (хэзээ хөрвүүлснийг админд харуулна). */
export interface LessonTranscript {
  text: string;
  /** Видеоны урт секундээр — зардлын бүртгэлд ордог. */
  seconds: number;
  at: string;
}

type Content = Record<string, unknown>;

const TRANSCRIPT_KEY = 'transcript';

/** `content.videoUrl` — байхгүй/буруу төрөлтэй бол `null`. */
export function readVideoUrl(content: Content): string | null {
  const url = content.videoUrl;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

/** Хадгалагдсан бичвэр — байхгүй эсвэл гэмтсэн бол `null`. */
export function readTranscript(content: Content): LessonTranscript | null {
  const raw = content[TRANSCRIPT_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<LessonTranscript>;
  if (typeof t.text !== 'string') return null;
  return {
    text: t.text,
    seconds: typeof t.seconds === 'number' ? t.seconds : 0,
    at: typeof t.at === 'string' ? t.at : '',
  };
}

/** Бичвэрийг суулгасан ШИНЭ content (оролт хөндөгдөхгүй). */
export function withTranscript(content: Content, transcript: LessonTranscript): Content {
  return { ...content, [TRANSCRIPT_KEY]: transcript };
}

/** Бичвэргүй ШИНЭ content — аппын хариунд явуулахын өмнө. */
export function stripTranscript(content: Content): Content {
  const { [TRANSCRIPT_KEY]: _removed, ...rest } = content;
  return rest;
}

/**
 * `PATCH /lessons/:id`-ийн хамгаалалт: хадгалагдсан бичвэрийг үргэлж сэргээж,
 * клиентээс ирсэн бичвэрийг үргэлж хаяна.
 */
export function preserveTranscript(stored: Content, incoming: Content): Content {
  const transcript = readTranscript(stored);
  const clean = stripTranscript(incoming);
  return transcript ? withTranscript(clean, transcript) : clean;
}
```

- [ ] **Step 4: Тест давж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/lessons/lesson-transcript.spec.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/lessons/lesson-transcript.ts backend/src/lessons/lesson-transcript.spec.ts
git commit -m "feat(lessons): транскриптийн цэвэр функцууд

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `LessonsService` — хөрвүүлэх, унших, хамгаалах

**Files:**
- Modify: `backend/src/lessons/lessons.service.ts`
- Modify: `backend/src/lessons/lessons.module.ts`
- Create: `backend/src/lessons/dto/update-transcript.dto.ts`
- Test: `backend/src/lessons/lessons.service.spec.ts` (шинэ)

⚠️ **Хамгийн эрсдэлтэй алхам.** `findOne()` бичвэрийг хасаж эхэлмэгц, түүнийг
дуудаад буцаагаад `save()` хийдэг код бүр (жишээ нь `update()`) бичвэрийг
**DB-ээс устгана**. Тиймээс дотоод дуудагчид тусдаа `findRaw()` ашиглана —
энэ нь Step 1-ийн тестээр баригдана.

- [ ] **Step 1: Тест бич (унах ёстой)**

Шинэ файл `backend/src/lessons/lessons.service.spec.ts`. Хиймэл repo-г
`never`-ээр дамжуулах загвар нь `src/hearts/hearts.service.spec.ts`-тэй ижил.

```ts
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
```

- [ ] **Step 2: Тест унаж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/lessons/lessons.service.spec.ts`
Expected: FAIL — `Expected 4 arguments, but got ...` / `svc.transcribe is not a function`

- [ ] **Step 3: DTO үүсгэх**

Шинэ файл `backend/src/lessons/dto/update-transcript.dto.ts`:

```ts
import { IsString, MaxLength } from 'class-validator';

/** Body for PATCH /api/lessons/:id/transcript — админы гараар засварласан бичвэр. */
export class UpdateTranscriptDto {
  /** Хоосон мөр зөвшөөрнө — админ буруу хөрвүүлэлтийг цэвэрлэж болно. */
  @IsString()
  @MaxLength(200_000)
  text: string;
}
```

- [ ] **Step 4: Service-ийг өөрчлөх**

`backend/src/lessons/lessons.service.ts`:

**(a)** import-ууд нэмнэ:

```ts
import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { AiUsage } from '../entities/ai-usage.entity';
import { AiUsageType } from '../common/enums';
import { STT_ADAPTER, type SttAdapter } from '../ai-gateway/providers/stt.adapter';
import {
  readVideoUrl,
  readTranscript,
  withTranscript,
  stripTranscript,
  preserveTranscript,
  type LessonTranscript,
} from './lesson-transcript';
```

(`XpSource, ContentLevel` одоо байгаа import-д `AiUsageType`-ыг нэмж бичнэ —
тусдаа мөр үүсгэхгүй.)

**(b)** constructor-т 2 dependency нэмнэ:

```ts
  constructor(
    @InjectRepository(Lesson)
    private readonly lessons: Repository<Lesson>,
    @InjectRepository(AiUsage)
    private readonly aiUsages: Repository<AiUsage>,
    @Inject(STT_ADAPTER)
    private readonly stt: SttAdapter,
    private readonly xp: XpService,
  ) {}
```

**(c)** `findOne` / `findAll`-ыг солино, `findRaw` нэмнэ:

```ts
  /**
   * Дотоод хэрэглээний хичээл — бичвэр нь ХЭВЭЭР. Хадгалах гэж байгаа код
   * ЗААВАЛ үүнийг ашиглана: `findOne()`-ийн хассан хувилбарыг `save()` хийвэл
   * бичвэр DB-ээс устана.
   */
  private async findRaw(id: string): Promise<Lesson> {
    const lesson = await this.lessons.findOne({ where: { id } });
    if (!lesson) throw new NotFoundException('Хичээл олдсонгүй');
    return lesson;
  }

  /** Гадагш буцаах хичээл — бичвэр хасагдсан ХУВИЛБАР (эх мөр хөндөгдөхгүй). */
  async findOne(id: string): Promise<Lesson> {
    const lesson = await this.findRaw(id);
    return { ...lesson, content: stripTranscript(lesson.content) };
  }
```

`findAll()`-ийн `return`-ийг солино:

```ts
    // Бичвэр нь зохиогчийн материал — сурагчийн апп руу явуулах шалтгаан алга
    // (жагсаалтад 20 хичээл × ~20KB болно).
    return {
      items: items.map((l) => ({ ...l, content: stripTranscript(l.content) })),
      total,
      page,
      limit,
    };
```

**(d)** `update()` / `remove()`-ийг `findRaw` дээр суулгаж, бичвэрийг хамгаална:

```ts
  async update(id: string, dto: UpdateLessonDto): Promise<Lesson> {
    const lesson = await this.findRaw(id);
    // Админы форм `content`-оо жагсаалтын хариунаас угсардаг бөгөөд тэнд
    // бичвэр байхгүй → хамгаалахгүй бол хадгалах бүрд устана.
    const content =
      dto.content !== undefined ? preserveTranscript(lesson.content, dto.content) : lesson.content;
    Object.assign(lesson, dto, { content });
    const saved = await this.lessons.save(lesson);
    return { ...saved, content: stripTranscript(saved.content) };
  }

  async remove(id: string): Promise<void> {
    const lesson = await this.findRaw(id);
    await this.lessons.remove(lesson);
  }
```

**(e)** Бичвэрийн 3 метод нэмнэ (класын төгсгөлд):

```ts
  // ── Видеоны бичвэр (транскрипт) ──────────────────────────────────────────

  /** Админд харуулах бичвэр. Хөрвүүлээгүй бол `text` хоосон. */
  async getTranscript(id: string): Promise<LessonTranscript> {
    const lesson = await this.findRaw(id);
    return readTranscript(lesson.content) ?? { text: '', seconds: 0, at: '' };
  }

  /**
   * Видеог ElevenLabs Scribe-аар бичвэр болгоно.
   *
   * Видео энэ процессоор дамжихгүй — Scribe-д URL өгнө (`transcribeUrl`).
   * Зардлыг `ai_usages`-д АДМИНЫ нэр дээр бичнэ: сурагчийн
   * `plans.sttMinutesLimit` рүү хүрэхгүй (тэр хязгаар buddy-гийн дуудлагын
   * цэг дээр тусдаа шалгагддаг), гэхдээ зардал хаанаас гарсан нь ил үлдэнэ.
   */
  async transcribe(id: string, adminId: string): Promise<LessonTranscript> {
    const lesson = await this.findRaw(id);
    const videoUrl = readVideoUrl(lesson.content);
    if (!videoUrl) {
      throw new BadRequestException('Эхлээд видео оруулна уу');
    }

    const result = await this.stt.transcribeUrl(videoUrl);
    if (!result.text) {
      throw new BadRequestException('Видеонээс яриа олдсонгүй — өөр видео оруулна уу');
    }

    const transcript: LessonTranscript = {
      text: result.text,
      seconds: result.seconds,
      at: new Date().toISOString(),
    };
    lesson.content = withTranscript(lesson.content, transcript);
    await this.lessons.save(lesson);

    await this.aiUsages.save(
      this.aiUsages.create({
        userId: adminId,
        type: AiUsageType.STT,
        model: 'scribe_v1',
        voiceSeconds: result.seconds,
        metadata: { purpose: 'lesson_transcript', lessonId: id },
      }),
    );

    return transcript;
  }

  /** Админы гараар засварласан бичвэрийг хадгална. */
  async saveTranscript(id: string, text: string): Promise<LessonTranscript> {
    const lesson = await this.findRaw(id);
    const previous = readTranscript(lesson.content);
    const transcript: LessonTranscript = {
      text,
      seconds: previous?.seconds ?? 0,
      at: previous?.at ?? new Date().toISOString(),
    };
    lesson.content = withTranscript(lesson.content, transcript);
    await this.lessons.save(lesson);
    return transcript;
  }
```

- [ ] **Step 5: Module-ийг холбох**

`backend/src/lessons/lessons.module.ts`-ийг бүтнээр солино:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from '../entities/lesson.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { LessonsService } from './lessons.service';
import { LessonsController } from './lessons.controller';
import { XpModule } from '../xp/xp.module';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';

/** Lesson CRUD. Exports LessonsService so the Sparks store (lesson unlock)
 *  and other modules can reuse it. Imports XP to reward lesson completion, and
 *  AiGateway for the shared STT adapter (video → transcript). */
@Module({
  imports: [TypeOrmModule.forFeature([Lesson, AiUsage]), XpModule, AiGatewayModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
```

- [ ] **Step 6: Компайл болж байгааг батал**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: алдаагүй (гаралт хоосон)

- [ ] **Step 7: Тест давж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/lessons/lessons.service.spec.ts`
Expected: PASS (9 tests)

Дараа нь бүхэлд нь: `cd backend && npm test`
Expected: бүх suite PASS (Task 1, 2-ын шинэ тестүүд орсон)

- [ ] **Step 8: Апп асаж байгааг батал (DI-ийн гогцоо шалгах)**

Run: `cd backend && npm run start:dev`
Expected: `Nest application successfully started` мөр гарна. `AiGatewayModule` ↔ `LessonsModule` хооронд circular dependency-ийн анхааруулга **гарах ёсгүй**. Шалгаад `Ctrl+C`.

- [ ] **Step 9: Commit**

```bash
git add backend/src/lessons/
git commit -m "feat(lessons): видеоноос бичвэр гаргах service давхарга

Бичвэр нь серверийн эзэмшилтэй: аппын хариунаас хасагдаж, PATCH-аар
дарагдахаас хамгаалагдана. findRaw() нь хадгалах замыг тусгаарлана.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `LessonsController` — 3 админ route

**Files:**
- Modify: `backend/src/lessons/lessons.controller.ts`

- [ ] **Step 1: Route-уудыг нэмэх**

Import-д нэмнэ:

```ts
import { UpdateTranscriptDto } from './dto/update-transcript.dto';
```

`@Get(':id')`-ийн **өмнө** дараах 3 route-ыг тавина (`:id`-ийн ард тавибал
`transcript` нь id гэж уншигдахгүй ч, дараалал нь бусад route-той адил
тодорхой байх нь дээр):

```ts
  /**
   * Видеог бичвэр болгоно (ElevenLabs Scribe). Админ-only: энэ нь мөнгө
   * зарцуулдаг дуудлага. 10 минутын видео ≈ 30–60 секунд тул синхрон.
   */
  @Post(':id/transcribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  transcribe(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.transcribe(id, user.id);
  }

  /** Админд бичвэрийг тусад нь өгнө — GET /lessons дээрээс хасагддаг. */
  @Get(':id/transcript')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  getTranscript(@Param('id', ParseUUIDPipe) id: string) {
    return this.lessonsService.getTranscript(id);
  }

  /** Гараар засварласан бичвэр. PATCH /lessons/:id үүнийг бичиж ЧАДАХГҮЙ. */
  @Patch(':id/transcript')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  saveTranscript(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTranscriptDto,
  ) {
    return this.lessonsService.saveTranscript(id, dto.text);
  }
```

- [ ] **Step 2: Компайл болж байгааг батал**

Run: `cd backend && npx tsc --noEmit -p tsconfig.json`
Expected: алдаагүй

- [ ] **Step 3: Гараар шалгах**

`npm run start:dev` ажиллаж байхад, админы JWT-гээр:

```bash
curl -s -X POST http://localhost:3000/api/lessons/<ВИДЕОГҮЙ-ХИЧЭЭЛИЙН-ID>/transcribe \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Expected: `400` + `"Эхлээд видео оруулна уу"`

```bash
curl -s http://localhost:3000/api/lessons/<ХИЧЭЭЛИЙН-ID>/transcript \
  -H "Authorization: Bearer <ADMIN_JWT>"
```

Expected: `{"text":"","seconds":0,"at":""}`

- [ ] **Step 4: Commit**

```bash
git add backend/src/lessons/lessons.controller.ts
git commit -m "feat(lessons): transcribe/transcript route-ууд

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Prompt-д `lessonSource` нэмэх

**Files:**
- Modify: `backend/src/quizzes/ai-generate.ts`
- Modify: `backend/src/quizzes/dto/ai-generate-quiz.dto.ts`
- Test: `backend/src/quizzes/ai-generate.spec.ts` (шинэ)

- [ ] **Step 1: Тест бич (унах ёстой)**

Шинэ файл `backend/src/quizzes/ai-generate.spec.ts`:

```ts
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
    expect(buildPrompt({ ...base, lessonSource: '   \n  ' })).not.toContain('ХИЧЭЭЛИЙН АГУУЛГА');
  });
});
```

- [ ] **Step 2: Тест унаж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/quizzes/ai-generate.spec.ts`
Expected: FAIL — `MAX_LESSON_SOURCE_CHARS` export байхгүй

- [ ] **Step 3: `ai-generate.ts`-ийг өөрчлөх**

**(a)** `GenerateOptions` interface-ийн `contextNote`-ийн ард нэмнэ:

```ts
  /**
   * Хичээлийн видеоны бичвэр (транскрипт). `contextNote`-оос ялгаатай нь энэ
   * нь **урт, эх материал** тул prompt-д тусдаа тэмдэглэгээтэй блок болж
   * орно — загвар үүнийг заавар биш, агуулга гэж уншина.
   */
  lessonSource?: string;
```

**(b)** тогтмолуудын хажууд нэмнэ (`MAX_QUESTION_COUNT`-ийн доор):

```ts
/**
 * Prompt-д орох бичвэрийн дээд урт. Зардлыг урьдчилан таамаглахуйц байлгах
 * (~4,000 токен) ба `runGeminiText`-ийн `MAX_TOKENS` хамгаалалтад мөргөхгүй
 * байх зорилготой. 12,000 тэмдэгт ≈ 25 минутын хичээлийн яриа.
 */
export const MAX_LESSON_SOURCE_CHARS = 12_000;
```

**(c)** `kindContext()`-ийн `o.kind === 'lesson'` салааг солино:

```ts
  if (o.kind === 'lesson') {
    const base =
      'Энэ бол тодорхой хичээлийн дараах шалгах тест. Хичээлийн агуулгад ' +
      'шууд тулгуурласан асуулт бич.';
    // Бичвэр нь монгол багшийн яриаг автоматаар хөрвүүлсэн байдаг. Үүнийг
    // хэлж өгөхгүй бол загвар бичвэрийн алдааг "заасан материал" гэж үзэж,
    // эсвэл монголоор асуулт бичиж эхэлдэг.
    return o.lessonSource
      ? `${base} Доорх бичвэр нь монгол багшийн тайлбар бөгөөд дунд нь англи ` +
          'жишээ орсон, автомат хөрвүүлсэн тул алдаатай байж болно. Бичвэрийн ' +
          'монгол хэсгийг сэдэв тодорхойлоход ашигла, асуултыг англиар бич.'
      : base;
  }
```

**(d)** `buildPrompt()`-ийн `lines` массивт, `АДМИНЫ ХҮСЭЛТ` блокийн **өмнө**
нэмнэ. Одоо байгаа:

```ts
    `АДМИНЫ ХҮСЭЛТ (үүн дээр үндэслэ):\n"""\n${o.brief.trim()}\n"""`,
```

Үүний өмнөх мөрөнд оруулна:

```ts
    ...(o.lessonSource?.trim()
      ? [
          'ХИЧЭЭЛИЙН АГУУЛГА (видеоны бичвэр):',
          `"""\n${o.lessonSource.trim().slice(0, MAX_LESSON_SOURCE_CHARS)}\n"""`,
          '',
        ]
      : []),
```

- [ ] **Step 4: DTO-д талбар нэмэх**

`backend/src/quizzes/dto/ai-generate-quiz.dto.ts`:

import-д `MAX_LESSON_SOURCE_CHARS`-ыг нэмнэ:

```ts
import {
  MAX_QUESTION_COUNT,
  MAX_LESSON_SOURCE_CHARS,
  type GenQuestionType,
  type TargetKind,
} from '../ai-generate';
```

`contextNote`-ийн ард нэмнэ:

```ts
  /**
   * Хичээлийн видеоны бичвэр — `kind: 'lesson'` үед админ дамжуулна.
   * `contextNote`-оос урт тул тусдаа талбар (prompt-д ч тусдаа блок болно).
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_LESSON_SOURCE_CHARS)
  lessonSource?: string;
```

`quizzes.service.ts`-д **өөрчлөлт хэрэггүй**: `aiGenerate` нь
`{ ...dto }`-оор `GenerateOptions` угсардаг тул шинэ талбар автоматаар урсана
(`src/quizzes/quizzes.service.ts:150`).

- [ ] **Step 5: Тест давж байгааг батал**

Run: `cd backend && npx jest --config jest.config.ts src/quizzes/ai-generate.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Бүх тест + компайл**

Run: `cd backend && npm test && npx tsc --noEmit -p tsconfig.json`
Expected: бүх suite PASS, компайлын алдаагүй

- [ ] **Step 7: Commit**

```bash
git add backend/src/quizzes/
git commit -m "feat(quizzes): prompt-д хичээлийн бичвэрийн блок нэмэв

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Admin — бичвэр гаргах, засах

**Files:**
- Modify: `admin/src/pages/lessons/LessonsPage.tsx`

- [ ] **Step 1: State + ачаалах логик нэмэх**

`LessonsPage()` доторх state-үүдийн ард нэмнэ:

```ts
  // ── Видеоны бичвэр ──
  // Хичээлийн жагсаалтын хариунд бичвэр ОРДОГГҮЙ (сервер хасдаг) тул засах
  // цонх нээгдэхэд тусад нь татна.
  const [transcript, setTranscript] = useState('');
  const [transcriptDirty, setTranscriptDirty] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
```

`openCreate()`-д нэмнэ (шинэ хичээлд бичвэр байхгүй):

```ts
  function openCreate() {
    setForm(emptyForm); setEditing(null); setError('');
    setTranscript(''); setTranscriptDirty(false);
    setModal('create');
  }
```

`openEdit(l)`-ийн `setModal('edit')`-ийн өмнө нэмнэ:

```ts
    setTranscript(''); setTranscriptDirty(false);
    api.get<{ text: string }>(`/lessons/${l.id}/transcript`)
      .then((t) => setTranscript(t.text ?? ''))
      .catch(() => setTranscript('')); // бичвэр байхгүй нь алдаа биш
```

- [ ] **Step 2: Хөрвүүлэх функц нэмэх**

`save()`-ийн өмнө нэмнэ:

```ts
  /** Видеог ElevenLabs Scribe-аар бичвэр болгоно (~30–60 сек). */
  async function runTranscribe() {
    if (!editing) return;
    setTranscribing(true); setError('');
    try {
      const t = await api.post<{ text: string }>(`/lessons/${editing.id}/transcribe`, {});
      setTranscript(t.text);
      setTranscriptDirty(false);
    } catch (e: unknown) {
      setError(friendlyError(e, 'Бичвэр гаргахад алдаа гарлаа'));
    } finally { setTranscribing(false); }
  }
```

- [ ] **Step 3: `save()`-д бичвэрийг хадгалах**

⚠️ Бичвэр нь `PATCH /lessons/:id`-аар бичигдэхгүй (сервер хамгаална) тул
тусдаа дуудлага хэрэгтэй. `save()` доторх `else if (editing) await api.patch(...)`
мөрийг солино:

```ts
      if (modal === 'create') await api.post('/lessons', payload);
      else if (editing) {
        await api.patch(`/lessons/${editing.id}`, payload);
        // Бичвэр нь серверийн эзэмшилтэй — үндсэн PATCH түүнийг бичихгүй.
        if (transcriptDirty) {
          await api.patch(`/lessons/${editing.id}/transcript`, { text: transcript });
        }
      }
```

- [ ] **Step 4: UI нэмэх**

`<FileUpload accept="video" ... />`-ийг агуулж буй `<div className="grid ...">`
блокийн **дараа** нэмнэ (мөр 245–256 орчим, зураг/видеоны grid-ийн ард):

```tsx
            {/* Видеоны бичвэр — AI тест үүсгэхэд контекст болно. Сурагчид
                харагдахгүй тул хөрвүүлэлтийн алдаа гамшиг биш; админ засна. */}
            {editing && form.videoUrl && (
              <div className="rounded-lg border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-800">Видеоны бичвэр</h3>
                  <Button variant="secondary" size="sm" onClick={runTranscribe} disabled={transcribing}>
                    <Sparkles className="h-4 w-4" />
                    {transcribing ? 'Хөрвүүлж байна…' : transcript ? 'Дахин гаргах' : 'Видеоноос бичвэр гаргах'}
                  </Button>
                </div>
                <p className="mb-2 text-xs text-gray-400">
                  AI тест үүсгэхэд ашиглана. Сурагчид харагдахгүй — алдаатай хэсгийг нь засаад хадгална уу.
                </p>
                <textarea
                  className="h-40 w-full rounded-lg border border-gray-200 p-2 text-sm"
                  placeholder="Хараахан хөрвүүлээгүй байна."
                  value={transcript}
                  onChange={(e) => { setTranscript(e.target.value); setTranscriptDirty(true); }}
                />
                <p className="mt-1 text-xs text-gray-400">{transcript.length.toLocaleString()} тэмдэгт</p>
              </div>
            )}
```

Import-д `Sparkles`-ыг нэмнэ (`lucide-react`-аас; `Film`, `Image` аль хэдийн байгаа).

- [ ] **Step 5: Компайл болж байгааг батал**

Run: `cd admin && npx tsc --noEmit`
Expected: алдаагүй

- [ ] **Step 6: Гараар шалгах**

Run: `cd admin && npm run dev`

1. Видеотой хичээл нээ → «Видеоны бичвэр» самбар харагдана.
2. «Видеоноос бичвэр гаргах» дар → 30–60 секундын дараа textarea дүүрнэ.
3. Текстийг зас → «Хадгалах» → цонхыг дахин нээ → **засвар үлдсэн** байх ёстой.
4. Юу ч засалгүй зүгээр «Хадгалах» дар → дахин нээ → **бичвэр байрандаа** байх ёстой (клиентийн merge устгаагүй эсэхийг шалгаж байна).

- [ ] **Step 7: Commit**

```bash
git add admin/src/pages/lessons/LessonsPage.tsx
git commit -m "feat(admin): хичээлийн видеоноос бичвэр гаргах самбар

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: Бичвэрийг тест генератор руу холбох

**Files:**
- Modify: `admin/src/components/AiBulkGenerator.tsx`
- Modify: `admin/src/pages/lessons/LessonTests.tsx`
- Modify: `admin/src/pages/lessons/LessonsPage.tsx` (prop дамжуулах)

- [ ] **Step 1: `AiTarget`-д талбар нэмэх**

`admin/src/components/AiBulkGenerator.tsx`, `AiTarget` interface-ийн
`contextNote`-ийн ард:

```ts
  /**
   * Хичээлийн видеоны бичвэр. `contextNote`-оос урт бөгөөд эх материал тул
   * prompt-д тусдаа блок болж ордог (backend `ai-generate.ts`).
   */
  lessonSource?: string;
```

- [ ] **Step 2: Хүсэлтэд оруулах**

Мөн файлын `generate()` доторх `api.post('/quizzes/ai-generate', {...})`-д,
`contextNote: target.contextNote,`-ийн ард нэмнэ:

```ts
        lessonSource: target.lessonSource,
```

- [ ] **Step 3: `LessonTests`-д prop нэмэх**

`admin/src/pages/lessons/LessonTests.tsx`, компонентийн параметрийг солино:

```tsx
export function LessonTests({
  lessonId,
  level,
  title,
  transcript,
}: {
  lessonId: string;
  level: string;
  /** Lesson title — given to the AI as context so questions match the lesson. */
  title?: string;
  /** Видеоны бичвэр — AI-д хичээлийн бодит агуулгыг өгнө. Хоосон бол зөвхөн
   *  гарчиг очно (өмнөх зан төлөв). */
  transcript?: string;
}) {
```

`<AiBulkGenerator target={{ ... }} />`-ийн `contextNote`-ийн ард нэмнэ:

```tsx
            lessonSource: transcript || undefined,
```

Мөн AI товчны доор сануулга нэмнэ (товчнуудын `<div className="mt-3">` дотор,
хамгийн ард):

```tsx
            {!transcript && (
              <p className="mt-2 text-xs text-amber-600">
                ⚠️ Видеоны бичвэр байхгүй тул AI зөвхөн гарчгаас үүсгэнэ. Дээрх
                «Видеоны бичвэр» хэсгээс гаргавал тест хичээлийн агуулгад
                тулгуурлана.
              </p>
            )}
```

- [ ] **Step 4: Prop-ыг дамжуулах**

`admin/src/pages/lessons/LessonsPage.tsx:278`-ийг солино:

```tsx
                <LessonTests lessonId={editing.id} level={form.level} title={form.title} transcript={transcript} />
```

- [ ] **Step 5: Компайл болж байгааг батал**

Run: `cd admin && npx tsc --noEmit`
Expected: алдаагүй

- [ ] **Step 6: Бүтэн урсгалыг гараар шалгах**

Run: `cd admin && npm run dev` (backend `npm run start:dev` ажиллаж байх)

1. Видеотой хичээл нээ → бичвэр гарга.
2. «Тестүүд» → ангилал сонго → «AI-аар үүсгэх».
3. Шар анхааруулга **алга** байх ёстой (бичвэр байгаа).
4. Богино brief бич (ж: «Энэ хичээлийн тест»), үүсгэ.
5. Гарсан асуултууд **видеон дээр яригдсан** үг/дүрэмтэй холбоотой эсэхийг шалга — энэ бол бүх ажлын гол шалгуур.
6. Бичвэргүй хичээл дээр дахин үзэж, шар анхааруулга гарч байгааг батал.

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/AiBulkGenerator.tsx admin/src/pages/lessons/
git commit -m "feat(admin): AI тест үүсгэгчид хичээлийн бичвэрийг өгнө

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: Баримтжуулалт

**Files:**
- Modify: `API.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: `API.md`-д 3 endpoint нэмэх**

Хичээлийн endpoint-уудын хэсэгт (`/lessons`) нэмнэ:

```markdown
| `POST` | `/lessons/:id/transcribe` | admin | Хичээлийн видеог ElevenLabs Scribe-аар бичвэр болгоно (`content.videoUrl` заавал). Синхрон, ~30–60 сек. Зардал `ai_usages`-д `purpose: lesson_transcript`-ээр бүртгэгдэнэ. |
| `GET` | `/lessons/:id/transcript` | admin | Хадгалагдсан бичвэр. `GET /lessons` ба `GET /lessons/:id` дээрээс бичвэр **хасагддаг** тул тусдаа. |
| `PATCH` | `/lessons/:id/transcript` | admin | Гараар засварласан бичвэр (`{ text }`). |

⚠️ `content.transcript` нь **серверийн эзэмшилтэй**: `PATCH /lessons/:id`
түүнийг бичиж ч, устгаж ч чадахгүй (`preserveTranscript`). Шалтгаан: админы
форм `content`-оо жагсаалтын хариунаас угсардаг бөгөөд тэнд бичвэр байхгүй.
```

`POST /quizzes/ai-generate`-ийн мөрөнд `lessonSource` талбарыг нэмж тэмдэглэнэ.

- [ ] **Step 2: `CLAUDE.md`-д товч бичлэг нэмэх**

"Current Status" хэсэгт, хамгийн сүүлийн бичлэгийн ард:

```markdown
**Видеоноос хичээлийн тест үүсгэдэг болов (2026-08-11).** Хичээлийн AI тест
генератор өмнө нь зөвхөн **гарчиг** хардаг байсан тул тест хичээлийн агуулгатай
холбоогүй, ерөнхий гардаг байв. Одоо админ «Видеоноос бичвэр гаргах» дарж
видеог ElevenLabs Scribe-аар хөрвүүлээд (видео сервер рүү татагдахгүй —
Scribe-д `source_url` өгнө), гарсан бичвэрийг **засаж** болно; тэр бичвэр
`POST /quizzes/ai-generate`-д `lessonSource` болж очно.
- Бичвэр нь `lesson.content.transcript`-д, **серверийн эзэмшилтэй**: аппын
  хариунаас хасагдана, `PATCH /lessons/:id`-аар дарагдахгүй. Засварыг
  `PATCH /lessons/:id/transcript`-аар. Шалтгаан: админы форм `content`-оо
  жагсаалтын хариунаас угсардаг тул хамгаалахгүй бол хадгалах бүрд устана.
- Видео холимог хэлтэй (монгол тайлбар + англи жишээ) тул Scribe-д
  `language_code` **өгөхгүй**. Бичвэр нь сурагчид харагдахгүй, зөвхөн AI-гийн
  контекст тул хөрвүүлэлтийн алдаа гамшиг биш.
- Migration/шинэ env **шаардлагагүй**; аппын шинэ bundle **хэрэггүй**
  (сурагчийн тал хөндөгдөөгүй). Зардал: 10 мин видео ≈ $0.07, нэг л удаа.
- Дэлгэрэнгүй → `docs/superpowers/specs/2026-08-11-lesson-video-transcript-tests-design.md`
```

- [ ] **Step 3: Commit**

```bash
git add API.md CLAUDE.md
git commit -m "docs: видеоноос тест үүсгэх урсгалыг баримтжуулав

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Дуусгах шалгуур

- [ ] `cd backend && npm test` — бүх suite PASS
- [ ] `cd backend && npx tsc --noEmit -p tsconfig.json` — алдаагүй
- [ ] `cd admin && npx tsc --noEmit` — алдаагүй
- [ ] Видеотой хичээл дээр бичвэр гарч, засвар нь хичээл хадгалсны дараа үлдэж байна
- [ ] Бичвэртэй хичээлээс үүсгэсэн тест нь видеон дээр яригдсан агуулгатай холбоотой
- [ ] `GET /lessons` хариунд `content.transcript` **алга**

PR нээхийн өмнө эзэмшигчээс зөвшөөрөл ав (санах ой: «Ask before opening a PR»).
