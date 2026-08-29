import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { TtsAdapter, TtsResult, VisemeCue } from './tts.adapter';

/**
 * Azure Speech HD Voice — text to speech **with viseme timing**.
 *
 * Why the SDK and not the REST endpoint: `VisemeReceived` events are only
 * delivered through the Speech SDK. The REST `cognitiveservices/v1` endpoint
 * returns audio bytes and nothing else, so it cannot drive lip-sync. That single
 * fact is why this adapter looks heavier than `GeminiTtsAdapter`.
 *
 * Output is **mp3**, not raw PCM: the reply travels phone-ward over Mongolian
 * mobile data, where 24 kHz PCM (~48 KB/s, uncompressed) is the dominant cost of
 * the whole turn.
 *
 * See docs/AZURE_VISEME_PLAN.md for the contract and the client half.
 */

/** Azure reports time in "ticks" of 100 nanoseconds. */
const TICKS_PER_MS = 10_000;

/** A well-reviewed multilingual HD voice; override with AZURE_TTS_VOICE. */
const DEFAULT_VOICE = 'en-US-AvaMultilingualNeural';

/** Give up on one synthesis attempt after this long. */
const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Voice used when the configured one fails (docx §4.2 "fallback standard
 * voice"). A standard neural voice is cheaper and more available than HD, and a
 * plain reply beats a silent buddy.
 */
const FALLBACK_VOICE = 'en-US-JennyNeural';

/**
 * Сул зогсож буй synthesizer-ийг дахин ашиглах хугацаа.
 *
 * Azure сул холболтыг өөрөө хаадаг; хэтэрсэн нэгийг ашиглах гэж оролдвол
 * эхний синтез унана. Түүнээс өмнө өөрсдөө хаях нь илүү хямд.
 */
const POOL_IDLE_TTL_MS = 4 * 60_000;

/** Voice тус бүрд санах ойд барих сул synthesizer-ийн дээд тоо. */
const POOL_MAX_PER_VOICE = 4;

/**
 * Azure-ийн voice нэрийн хэлбэр: `<locale>-<Name>` (ж: `en-US-AvaMultilingualNeural`,
 * `en-US-Tyler:DragonHDFlashLatestNeural`).
 *
 * Яагаад жагсаалт биш хэлбэрээр шалгадаг вэ: Azure-д мянга гаруй voice байгаа
 * бөгөөд шинэ HD voice байнга нэмэгддэг тул хатуу жагсаалт нь зөв voice-ыг
 * татгалзах болно. Харин `Kore` (Gemini) эсвэл ElevenLabs-ийн UUID зэрэг өөр
 * провайдерын үлдэгдэл нь locale угтваргүй тул энэ шалгуурт унана.
 */
const AZURE_VOICE_RE = /^[a-z]{2,3}(-[A-Za-z]{2,8})?-[A-Z][\w:-]*$/;

/** Escape text before it goes inside SSML — a stray `&` kills the whole request. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

@Injectable()
export class AzureTtsAdapter implements TtsAdapter {
  private readonly logger = new Logger(AzureTtsAdapter.name);

  /**
   * Voice тус бүрийн сул synthesizer-ууд.
   *
   * **Яагаад:** `SpeechSynthesizer` бүр өөрийн WebSocket-ыг нээдэг ба SDK нь
   * түүнийг эхний синтезийн үед барьдаг. Хэсэг бүрд шинийг үүсгэх нь handshake
   * -ийг turn тутамд (streaming үед хэсэг тутамд!) дахин төлнө гэсэн үг.
   * Хэмжилт: эхний аудио хүртэл **p50 799мс → 159мс**.
   *
   * ⚠️ Нэг instance дээр зэрэг хоёр синтез явуулж БОЛОХГҮЙ: `synthesizing` ба
   * `visemeReceived` нь instance-ийн талбар тул хоёр turn-ийн viseme хольцолдоно.
   * Тиймээс энэ нь pool — ашиглах хугацаанд instance-ийг жагсаалтаас **гаргаж**
   * авч, дуусмагц буцаана.
   */
  private readonly pool = new Map<
    string,
    { synthesizer: sdk.SpeechSynthesizer; idleSince: number }[]
  >();

  constructor(private readonly config: ConfigService) {}

  /** Сул synthesizer авах, эсвэл шинийг үүсгэх. */
  private acquire(voice: string): sdk.SpeechSynthesizer {
    const idle = this.pool.get(voice) ?? [];
    const now = Date.now();
    while (idle.length) {
      const entry = idle.pop()!;
      if (now - entry.idleSince < POOL_IDLE_TTL_MS) return entry.synthesizer;
      this.dispose(entry.synthesizer); // хэтэрсэн — ашиглах гэж оролдохгүй
    }

    const key = this.config.get<string>('AZURE_SPEECH_KEY');
    const region = this.config.get<string>('AZURE_SPEECH_REGION');
    if (!key || !region) {
      throw new InternalServerErrorException(
        'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION тохируулаагүй байна',
      );
    }
    const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechSynthesisVoiceName = voice;
    // 48 kbit mp3: ~12× smaller than the 24 kHz PCM the Gemini adapter returns,
    // at a bitrate that is still clean for a single speaking voice.
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
    // `null` audio config, NOT undefined: undefined makes the SDK open the
    // default speaker, which on a server is either absent or a hang.
    return new sdk.SpeechSynthesizer(speechConfig, null);
  }

  /** Эрүүл synthesizer-ийг буцааж тавина; багтахгүй бол хаана. */
  private release(voice: string, synthesizer: sdk.SpeechSynthesizer): void {
    const idle = this.pool.get(voice) ?? [];
    if (idle.length >= POOL_MAX_PER_VOICE) {
      this.dispose(synthesizer);
      return;
    }
    // Дараагийн ашиглалт өөрийн handler-уудаа тавих боловч энд цэвэрлэх нь
    // pool-д хэвтэж буй instance хуучин turn руу үйл явдал илгээхээс сэргийлнэ.
    synthesizer.synthesizing = undefined as never;
    synthesizer.visemeReceived = undefined as never;
    idle.push({ synthesizer, idleSince: Date.now() });
    this.pool.set(voice, idle);
  }

  private dispose(synthesizer: sdk.SpeechSynthesizer): void {
    try {
      synthesizer.close();
    } catch {
      /* already closed */
    }
  }

  /**
   * Аль voice бодитоор ярихыг шийднэ.
   *
   * `buddy.voiceId` нь админаас ирдэг ба админы жагсаалт удаан хугацаанд
   * **Gemini**-гийн нэрсийг санал болгож байсан. Тэр үлдэгдлийг шууд Azure руу
   * дамжуулбал эхний synthesis унаад `FALLBACK_VOICE` рүү чимээгүй буудаг:
   * turn бүр ХОЁР synthesis дуудлага (латенси хоёр дахин), буруу дуу хоолой,
   * гэвч viseme ажилладаг тул алдаа нь огт мэдэгдэхгүй. Тиймээс өөр
   * провайдерын нэрийг энд шүүж, тохируулсан voice руу буцаана.
   *
   * Мөн `speak()`-ийн cache түлхүүрт хэрэглэгддэг (buddy.service) — эс бөгөөс
   * env-ийн voice солиход хуучин клип cache-ээс үргэлжлэн гарна.
   */
  resolveVoice(voiceId?: string | null): string {
    const configured = this.config.get<string>(
      'AZURE_TTS_VOICE',
      DEFAULT_VOICE,
    );
    if (!voiceId) return configured;
    if (AZURE_VOICE_RE.test(voiceId)) return voiceId;
    this.logger.warn(
      `"${voiceId}" нь Azure-ийн voice нэр биш (өөр провайдерын үлдэгдэл байх магадлалтай) — "${configured}" ашиглана`,
    );
    return configured;
  }

  async synthesize(
    text: string,
    voiceId?: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult> {
    // Config, not a voice problem: bail before the fallback retry below, which
    // would only fail the same way and log a misleading "voice failed" warning.
    if (
      !this.config.get<string>('AZURE_SPEECH_KEY') ||
      !this.config.get<string>('AZURE_SPEECH_REGION')
    ) {
      throw new InternalServerErrorException(
        'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION тохируулаагүй байна',
      );
    }
    const voice = this.resolveVoice(voiceId);
    try {
      return await this.speak(text, voice, params);
    } catch {
      // Retry #1 — SAME voice, guaranteed-fresh connection.
      //
      // Since synthesizers are pooled, the most common failure is no longer "bad
      // voice" but "the pooled connection went stale". Jumping straight to the
      // fallback voice would answer a connection problem by permanently
      // downgrading the buddy's voice — and it would look like the HD voice is
      // broken. The failed connection has already been closed, so this attempt
      // opens a new one.
      try {
        return await this.speak(text, voice, params);
      } catch (second) {
        // Retry #2 — the fallback voice. Now a repeat failure really does point
        // at the voice itself (a bad name, or one not offered in this region).
        if (voice === FALLBACK_VOICE) throw second;
        this.logger.warn(
          `Azure TTS failed twice on "${voice}", falling back to ${FALLBACK_VOICE}: ${
            second instanceof Error ? second.message : second
          }`,
        );
        return this.speak(text, FALLBACK_VOICE, params);
      }
    }
  }

  /** One synthesis attempt: SSML in, audio + viseme timeline out. */
  private speak(
    text: string,
    voice: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult> {
    const synthesizer = this.acquire(voice);

    const visemes: VisemeCue[] = [];
    synthesizer.visemeReceived = (_s, e) => {
      visemes.push({
        id: e.visemeId,
        offsetMs: Math.round(e.audioOffset / TICKS_PER_MS),
      });
    };

    // t5 → t6. `synthesizing` нь аудио хэсэг бүрд, эхнийх нь синтез дуусахаас
    // нэлээд өмнө ирдэг — өөрөөр хэлбэл streaming тоглуулалт хийвэл хэрэглэгч
    // ЭНЭ агшинд сонсож эхлэх боломжтой. Хэмжихгүй бол streaming хэр их
    // хожихыг зөвхөн таамаглах л боломжтой.
    const requestedAt = Date.now();
    let firstAudioMs: number | undefined;
    synthesizer.synthesizing = () => {
      if (firstAudioMs === undefined) firstAudioMs = Date.now() - requestedAt;
    };

    const timeoutMs = Number(
      this.config.get<string>(
        'AZURE_TTS_TIMEOUT_MS',
        String(DEFAULT_TIMEOUT_MS),
      ),
    );

    return new Promise<TtsResult>((resolve, reject) => {
      // Settle exactly once, from whichever path finishes first.
      //
      // `keep` decides the synthesizer's fate: a clean synthesis returns it to
      // the pool (that reuse is the whole latency win), while a cancel/timeout
      // closes it — a connection that just failed is the last one to hand to
      // the next student.
      let settled = false;
      const finish = (fn: () => void, keep = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (keep) this.release(voice, synthesizer);
        else this.dispose(synthesizer);
        fn();
      };

      const timer = setTimeout(
        () =>
          finish(() =>
            reject(
              new InternalServerErrorException(
                `Azure TTS timed out after ${timeoutMs} ms`,
              ),
            ),
          ),
        timeoutMs,
      );

      synthesizer.speakSsmlAsync(
        // `|| undefined`, `??` БИШ: `.env`-д "AZURE_TTS_RATE=" гэж хоосон
        // орхиход ConfigService `undefined` биш ХООСОН МӨР буцаадаг тул `??`
        // түүнийг хүчинтэй утга гэж үзэж, `<prosody rate="">` үүсгэнэ — Azure
        // үүнийг хүчингүй SSML гэж татгалзана. Хоосон = тохируулаагүй.
        buildSsml(text, voice, params, {
          rate: this.config.get<string>('AZURE_TTS_RATE') || undefined,
          pitch: this.config.get<string>('AZURE_TTS_PITCH') || undefined,
        }),
        (result) => {
          if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
            const details =
              sdk.CancellationDetails.fromResult(result).errorDetails;
            finish(() =>
              reject(
                new InternalServerErrorException(
                  `Azure TTS cancelled: ${details}`,
                ),
              ),
            );
            return;
          }
          const audio = Buffer.from(result.audioData);
          finish(
            () =>
              resolve({
              audio,
              // `audioDuration` is ticks too. Fall back to the last viseme if a
              // voice ever reports 0, so the avatar still gets a length.
              durationMs:
                Math.round(result.audioDuration / TICKS_PER_MS) ||
                (visemes.length ? visemes[visemes.length - 1].offsetMs : 0),
              model: voice,
              voiceId: voice,
              mimeType: 'audio/mpeg',
              fileExtension: 'mp3',
              // Sorted defensively: the events arrive in order today, but the
              // client binary-searches this and would silently mis-shape if not.
                visemes: visemes.sort((a, b) => a.offsetMs - b.offsetMs),
                firstAudioMs,
              }),
            true, // clean run → back to the pool
          );
        },
        (error) =>
          finish(() =>
            reject(new InternalServerErrorException(`Azure TTS: ${error}`)),
          ),
      );
    });
  }
}

/** Эхний утга учиртай (null/undefined/хоосон биш) сонголтыг буцаана. */
function firstSet(...values: unknown[]): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

/**
 * SSML for one reply.
 *
 * `<mstts:viseme type="redlips_front"/>` asks for the mouth-position event
 * stream; without it some voices emit no visemes at all — which would look
 * exactly like "Azure doesn't support this voice" during the Go/No-Go test.
 *
 * `rate`/`pitch`/`style` come from the buddy's `ttsParams` (set in admin), so a
 * persona can be slowed down for beginners without a code change. Every one of
 * them is admin-supplied text going into markup, so all of them are escaped:
 * an unescaped `"` in a style name would break out of the attribute.
 *
 * Exported for tests — the escaping is the part worth pinning.
 */
export function buildSsml(
  text: string,
  voice: string,
  params?: Record<string, unknown>,
  defaults?: { rate?: string; pitch?: string },
): string {
  // `firstSet`, `??` БИШ: хоосон мөр нь "тохируулаагүй" гэсэн үг. `.env`-д
  // "AZURE_TTS_RATE=" гэж орхиход ConfigService '' буцаадаг ба `??` түүнийг
  // хүчинтэйд тооцвол `rate=""` гарч, Azure SSML-ийг бүхэлд нь татгалзана.
  const rate = firstSet(params?.rate, defaults?.rate) ?? '0%';
  const pitch = firstSet(params?.pitch, defaults?.pitch) ?? '0%';
  const style = params?.style ? String(params.style) : null;

  const spoken = `<prosody rate="${escapeXml(rate)}" pitch="${escapeXml(
    pitch,
  )}">${escapeXml(text)}</prosody>`;

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">
  <voice name="${escapeXml(voice)}">
    <mstts:viseme type="redlips_front"/>
    ${style ? `<mstts:express-as style="${escapeXml(style)}">${spoken}</mstts:express-as>` : spoken}
  </voice>
</speak>`;
}
