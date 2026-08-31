/**
 * One timed mouth shape: an Azure viseme id (0–21) and when it starts, in ms
 * from the beginning of the audio. Providers that can't report timing omit the
 * whole list and the app falls back to shapes guessed from the reply text.
 */
export interface VisemeCue {
  id: number;
  offsetMs: number;
}

/** Result of a text-to-speech call: raw audio bytes + how long they play. */
export interface TtsResult {
  audio: Buffer;
  durationMs: number;
  model: string;
  voiceId: string;
  /**
   * Content type of `audio` and the extension it should be stored under.
   *
   * Not cosmetic: these used to be hard-coded as mp3 at the call site while the
   * adapter actually returned WAV, so every cached clip was served under a
   * content type it wasn't. Adapters now state their own format.
   */
  mimeType: string;
  fileExtension: string;
  /** Lip-sync timeline, when the provider gives one (Azure HD Voice). */
  visemes?: VisemeCue[];
  /**
   * Хүсэлт илгээснээс хойш провайдерын **эхний аудио хэсэг** ирэх хүртэлх ms
   * (латенсийн төлөвлөгөө §1: t5 → t6).
   *
   * Синтезийн нийт хугацаанаас тусад нь байх нь чухал: streaming тоглуулалт
   * хийхэд хэрэглэгчийн хүлээх хугацаа нь ЭНЭ тоо болно, харин нийт хугацаа нь
   * зөвхөн одоогийн "бүгдийг хүлээх" аргад л хамаатай. Хоёрын зөрүү нь
   * streaming-ээс хэдэн ms хожихыг шууд хэлж өгнө.
   *
   * Хэсэгчилсэн үйл явдал өгдөггүй провайдер орхино.
   */
  firstAudioMs?: number;
}

/**
 * Text → speech. The single seam for swapping TTS providers. Returns raw audio;
 * storage stays with the caller (ImageStorage).
 */
export interface TtsAdapter {
  synthesize(
    text: string,
    voiceId?: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult>;

  /**
   * Хүсэлтийн voice id → тухайн провайдер бодитоор ярих voice-ийн нэр.
   *
   * Provider бүр өөр өөрийн нэрийн орон зайтай тул нөгөөгийнх нь нэр (эсвэл
   * устсан провайдерын үлдэгдэл) ирж болно; adapter бүр түүнийгээ шүүж
   * анхдагч руугаа буцаана.
   *
   * Interface дээр байгаагийн шалтгаан нь **дуут cache**: `buddy.service` нь
   * клипийг `voiceId:text`-ээр түлхүүрлэдэг бөгөөд хүсэлтийн (шүүгдээгүй)
   * утгыг ашиглавал өөр хоёр voice нэг мөрийг хуваалцаж, voice сольсны дараа ч
   * хуучин аудио үргэлжлэн гарна.
   */
  resolveVoice(voiceId?: string | null): string;
}

/** DI token for the active TTS adapter. */
export const TTS_ADAPTER = 'TTS_ADAPTER';
