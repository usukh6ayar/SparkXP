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
