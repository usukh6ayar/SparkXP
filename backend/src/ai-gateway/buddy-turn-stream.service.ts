import { Injectable, Logger } from '@nestjs/common';
/**
 * Нэг turn-ийн аудио хэсгүүдийг **бэлэн болмогц** нь клиентэд хүргэх бүртгэл.
 *
 * Яагаад ийм хэлбэртэй вэ: React Native-ийн `fetch` (Expo Go, SDK 54) хариуг
 * хэсэгчлэн уншиж чаддаггүй — `res.body.getReader()` байхгүй. Тиймээс "нэг
 * хүсэлт, урсгалаар нь буцаах" арга ажиллахгүй. Оронд нь:
 *
 *  1. клиент turn-ийн id-г **өөрөө үүсгээд** turn-ийн хүсэлттэй хамт илгээнэ;
 *  2. тэр хүсэлт нисэж байх зуур клиент энэ бүртгэлээс `chunk 0`-ыг **зэрэг**
 *     гуйна (урт-хүлээлт: хэсэг бэлэн болмогц хариу шууд буцна, poll завсаргүй);
 *  3. сервер LLM-ийн текстийг хэсэглэн TTS хийж, хэсэг бүрийг энд нийтэлнэ.
 *
 * Ингэснээр `TurnResponse` гэрээ **хэвээр** үлдэнэ: хуучин апп зүгээр л хэсэг
 * гуйхгүй бөгөөд өнөөдрийнхтэй яг ижил ажиллана.
 *
 * Аудионы байт нь санах ойд байна — R2 руу байршуулах нь **тоглуулалтын
 * урьдчилсан нөхцөл биш**, зэрэгцээ явж кэшийг дүүргэнэ.
 */
export interface TurnAudioChunk {
  index: number;
  /** Энэ хэсэгт ярьсан текст (UI-д хэрэгтэй, мөн дибаг). */
  text: string;
  mimeType: string;
  durationMs: number;
  /**
   * Уруулын цаг. Талбарын нэр нь `offset_ms` — `TurnResponse.visemes`-тэй
   * ЯГ ижил хэлбэр, ингэснээр апп хоёуланд нь нэг задлагч ашиглана.
   */
  visemes: { id: number; offset_ms: number }[] | null;
  /**
   * Эхний хэсэгтэй хамт явах царайны илэрхийлэл.
   *
   * Гэрээнд `emotion` нь `reply_text`-ээс өмнө ирдэг тул turn дуустал хүлээхгүй
   * — аватар эхний үгнээс л зөв төрхтэй байна.
   */
  emotion: string | null;
  /** Сүүлийн хэсэг үү (үүний дараа юу ч ирэхгүй). */
  last: boolean;
}

interface TurnStream {
  userId: string;
  chunks: TurnAudioChunk[];
  audio: Buffer[];
  done: boolean;
  failed: boolean;
  aborted: boolean;
  createdAt: number;
  /** Хараахан ирээгүй хэсгийг хүлээж буй урт-хүлээлтүүд. */
  waiters: (() => void)[];
}

/** Хаягдсан turn-ийг цэвэрлэх хугацаа (аудио нь санах ойд байдаг). */
const TURN_TTL_MS = 3 * 60_000;
/** Нэг урт-хүлээлтийн дээд хугацаа — RN-ийн fetch timeout-аас доогуур. */
const WAIT_TIMEOUT_MS = 20_000;

@Injectable()
export class BuddyTurnStreamService {
  private readonly logger = new Logger('BuddyTurnStream');
  private readonly turns = new Map<string, TurnStream>();

  /**
   * Turn эхлэхэд бүртгэнэ.
   *
   * Клиент хэсгээ turn-ийн хүсэлттэй **зэрэг** гуйдаг тул түүний эхний хүсэлт
   * энэ дуудлагаас өмнө ирэх нь ердийн зүйл (turn нь STT-ийн ард эхэлдэг).
   * Тэр тохиолдолд `waitFor` түр бүртгэл үүсгэсэн байх тул түүнийг **дахин
   * ашиглана** — дарж бичвэл аль хэдийн хүлээж буй хүсэлт мөнхөд өлгөгдөнө.
   */
  open(turnId: string, userId: string): void {
    this.sweep();
    const existing = this.turns.get(turnId);
    if (existing && existing.userId === userId) {
      existing.createdAt = Date.now();
      return;
    }
    if (existing) this.wake(existing); // өөр хэрэглэгчийнхийг сэрээж суллана
    this.turns.set(turnId, this.blank(userId));
  }

  private blank(userId: string): TurnStream {
    return {
      userId,
      chunks: [],
      audio: [],
      done: false,
      failed: false,
      aborted: false,
      createdAt: Date.now(),
      waiters: [],
    };
  }

  /** Бэлэн болсон аудио хэсгийг нийтэлж, хүлээж буй бүх хүсэлтийг сэрээнэ. */
  publish(turnId: string, chunk: TurnAudioChunk, audio: Buffer): void {
    const turn = this.turns.get(turnId);
    if (!turn || turn.aborted) return;
    turn.chunks[chunk.index] = chunk;
    turn.audio[chunk.index] = audio;
    if (chunk.last) turn.done = true;
    this.wake(turn);
  }

  /** Turn дуусав (аудиогүй ч байж болно — ж: TTS унасан). */
  finish(turnId: string, failed = false): void {
    const turn = this.turns.get(turnId);
    if (!turn) return;
    turn.done = true;
    turn.failed = failed;
    this.wake(turn);
  }

  /**
   * Barge-in: хэрэглэгч дахин ярьж эхлэв. Үлдсэн хэсгүүдийг хаяна; ажиллаж буй
   * LLM/TTS-ийг таслах нь дуудагчийн `AbortSignal`-ын ажил.
   */
  abort(turnId: string, userId: string): void {
    const turn = this.turns.get(turnId);
    if (!turn || turn.userId !== userId) return;
    turn.aborted = true;
    turn.done = true;
    this.wake(turn);
  }

  isAborted(turnId: string): boolean {
    return this.turns.get(turnId)?.aborted ?? false;
  }

  /**
   * `index`-тэй хэсгийг хүлээнэ.
   *
   * Урт-хүлээлт: хэсэг аль хэдийн байвал шууд, үгүй бол бэлэн болтол хүлээнэ.
   * Энэ нь poll-ын завсарлагыг арилгана — first-audio дээр 150–250 мс гэдэг
   * бодит зөрүү. Turn дуусаад тэр индекс байхгүй бол `null`.
   */
  async waitFor(
    turnId: string,
    index: number,
    userId: string,
  ): Promise<{ chunk: TurnAudioChunk | null; aborted: boolean }> {
    let turn = this.turns.get(turnId);
    // Хараахан бүртгэгдээгүй бол ЭНД бүртгэнэ. Клиентийн эхний хүсэлт нь
    // turn-ийн хүсэлтээс өмнө ирдэг (turn нь STT-ийн ард эхэлдэг) тул "мэдэхгүй
    // turn" гэж шууд буцаавал урсгал хэзээ ч ашиглагдахгүй — Phase 2-ын бүх
    // хожил чимээгүй алга болно. Бүртгэл нь хүсэгч хэрэглэгчид холбогдоно.
    if (!turn) {
      turn = this.blank(userId);
      this.turns.set(turnId, turn);
    }
    if (turn.userId !== userId) return { chunk: null, aborted: false };

    const deadline = Date.now() + WAIT_TIMEOUT_MS;
    for (;;) {
      if (turn.aborted) return { chunk: null, aborted: true };
      const chunk = turn.chunks[index];
      if (chunk) return { chunk, aborted: false };
      if (turn.done) return { chunk: null, aborted: false };
      const remaining = deadline - Date.now();
      if (remaining <= 0) return { chunk: null, aborted: false };
      await this.sleepUntilWake(turn, remaining);
    }
  }

  /** Тухайн хэсгийн аудио байт (`GET …/audio/:index` үүнийг дамжуулна). */
  audioFor(turnId: string, index: number, userId: string): Buffer | null {
    const turn = this.turns.get(turnId);
    if (!turn || turn.userId !== userId) return null;
    return turn.audio[index] ?? null;
  }

  private wake(turn: TurnStream): void {
    const waiters = turn.waiters;
    turn.waiters = [];
    for (const w of waiters) w();
  }

  private sleepUntilWake(turn: TurnStream, ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(finish, ms);
      function finish() {
        clearTimeout(timer);
        resolve();
      }
      turn.waiters.push(finish);
    });
  }

  /** Хаягдсан turn-ийг цэвэрлэнэ — аудио санах ойд байдаг тул заавал. */
  private sweep(): void {
    const now = Date.now();
    for (const [id, turn] of this.turns) {
      if (now - turn.createdAt > TURN_TTL_MS) {
        turn.aborted = true;
        this.wake(turn);
        this.turns.delete(id);
      }
    }
    if (this.turns.size > 500) {
      this.logger.warn(`${this.turns.size} turn санах ойд хуримтлагдлаа`);
    }
  }
}
