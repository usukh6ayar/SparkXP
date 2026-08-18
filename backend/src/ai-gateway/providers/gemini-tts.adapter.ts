import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TtsAdapter, TtsResult } from './tts.adapter';

/** Gemini TTS returns raw PCM: 24 kHz, 16-bit, mono, little-endian. */
const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;
/** One of Gemini's prebuilt voices (see the admin voice list). */
const DEFAULT_VOICE = 'Kore';
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-tts';

/**
 * Gemini's prebuilt voice names. Buddies that still carry an old ElevenLabs
 * voice id (or any unknown name) fall back to the default, so switching to
 * Gemini can't break an existing buddy's voice before admin re-picks one.
 */
const GEMINI_VOICES = new Set([
  'Zephyr',
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Leda',
  'Orus',
  'Aoede',
  'Callirrhoe',
  'Autonoe',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Despina',
  'Erinome',
  'Algenib',
  'Rasalgethi',
  'Laomedeia',
  'Achernar',
  'Alnilam',
  'Schedar',
  'Gacrux',
  'Pulcherrima',
  'Achird',
  'Zubenelgenubi',
  'Vindemiatrix',
  'Sadachbia',
  'Sadaltager',
  'Sulafat',
]);

/** Wrap raw PCM in a 44-byte WAV header so players (expo-audio) can play it. */
function pcmToWav(pcm: Buffer): Buffer {
  const blockAlign = (CHANNELS * BITS_PER_SAMPLE) / 8;
  const byteRate = SAMPLE_RATE * blockAlign;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/**
 * Gemini text-to-speech — the Google text-to-speech for buddy replies + word/idiom audio.
 *
 * Calls `gemini-2.5-flash-preview-tts:generateContent` with a prebuilt voice and
 * gets back raw PCM, which we wrap into a WAV buffer. `voiceId` here is a Gemini
 * voice NAME (e.g. "Kore", "Puck") — the per-buddy voice set in admin.
 */
@Injectable()
export class GeminiTtsAdapter implements TtsAdapter {
  private readonly logger = new Logger(GeminiTtsAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, voiceId?: string): Promise<TtsResult> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'GEMINI_API_KEY тохируулаагүй байна',
      );
    }
    const model = this.config.get<string>('GEMINI_TTS_MODEL', DEFAULT_MODEL);
    const requested =
      voiceId ?? this.config.get<string>('GEMINI_TTS_VOICE', DEFAULT_VOICE);
    // Fall back if it's not a Gemini voice (e.g. a leftover ElevenLabs id).
    const voice = GEMINI_VOICES.has(requested) ? requested : DEFAULT_VOICE;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          },
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(
        `Gemini TTS failed (${response.status}): ${body.slice(0, 300)}`,
      );
      throw new InternalServerErrorException('Аудио үүсгэхэд алдаа гарлаа');
    }

    const data = (await response.json()) as {
      candidates?: {
        content?: { parts?: { inlineData?: { data?: string } }[] };
      }[];
    };
    const base64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64) {
      this.logger.error('Gemini TTS returned no audio data');
      throw new InternalServerErrorException('Аудио үүсгэхэд алдаа гарлаа');
    }

    const pcm = Buffer.from(base64, 'base64');
    const audio = pcmToWav(pcm);
    const durationMs = Math.round(
      (pcm.length / (SAMPLE_RATE * (BITS_PER_SAMPLE / 8))) * 1000,
    );
    return { audio, durationMs, model, voiceId: voice };
  }
}
