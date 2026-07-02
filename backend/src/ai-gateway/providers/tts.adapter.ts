import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Result of a text-to-speech call: raw mp3 bytes + how long they play. */
export interface TtsResult {
  audio: Buffer;
  durationMs: number;
  model: string;
  voiceId: string;
}

/**
 * Text → speech. The single seam for swapping TTS providers (docx: no hardcoded
 * providers). Returns raw audio; storage stays with the caller (ImageStorage).
 */
export interface TtsAdapter {
  synthesize(
    text: string,
    voiceId?: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult>;
}

/** DI token for the active TTS adapter. */
export const TTS_ADAPTER = 'TTS_ADAPTER';

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
// We request a constant-bitrate 128kbps mp3 so duration ≈ bytes / 16 (ms).
const OUTPUT_FORMAT = 'mp3_44100_128';
const BYTES_PER_MS = 16;

/** ElevenLabs implementation of {@link TtsAdapter}. */
@Injectable()
export class ElevenLabsTtsAdapter implements TtsAdapter {
  private readonly logger = new Logger(ElevenLabsTtsAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async synthesize(
    text: string,
    voiceId?: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult> {
    const apiKey = this.config.get<string>('ELEVENLABS_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('ELEVENLABS_API_KEY тохируулаагүй байна');
    }
    const resolvedVoice =
      voiceId ?? this.config.get<string>('ELEVENLABS_VOICE_ID', DEFAULT_VOICE_ID);
    const model = this.config.get<string>('ELEVENLABS_MODEL', DEFAULT_MODEL);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoice}?output_format=${OUTPUT_FORMAT}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: model,
          ...(params?.voiceSettings ? { voice_settings: params.voiceSettings } : {}),
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      this.logger.error(`ElevenLabs TTS failed (${response.status}): ${body}`);
      throw new InternalServerErrorException('Аудио үүсгэхэд алдаа гарлаа');
    }

    const audio = Buffer.from(await response.arrayBuffer());
    const durationMs = Math.round(audio.length / BYTES_PER_MS);
    return { audio, durationMs, model, voiceId: resolvedVoice };
  }
}
