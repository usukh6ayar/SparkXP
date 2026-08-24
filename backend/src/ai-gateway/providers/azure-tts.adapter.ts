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

  constructor(private readonly config: ConfigService) {}

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
    const voice =
      voiceId ?? this.config.get<string>('AZURE_TTS_VOICE', DEFAULT_VOICE);
    try {
      return await this.speak(text, voice, params);
    } catch (err) {
      // One retry on the fallback voice. Retrying the *same* voice is usually
      // pointless — the common failures are a bad voice name or an HD voice not
      // offered in this region, and neither gets better on a second try.
      if (voice === FALLBACK_VOICE) throw err;
      this.logger.warn(
        `Azure TTS failed on "${voice}", retrying on ${FALLBACK_VOICE}: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return this.speak(text, FALLBACK_VOICE, params);
    }
  }

  /** One synthesis attempt: SSML in, audio + viseme timeline out. */
  private speak(
    text: string,
    voice: string,
    params?: Record<string, unknown>,
  ): Promise<TtsResult> {
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
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig, null);

    const visemes: VisemeCue[] = [];
    synthesizer.visemeReceived = (_s, e) => {
      visemes.push({
        id: e.visemeId,
        offsetMs: Math.round(e.audioOffset / TICKS_PER_MS),
      });
    };

    const timeoutMs = Number(
      this.config.get<string>('AZURE_TTS_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)),
    );

    return new Promise<TtsResult>((resolve, reject) => {
      // Close exactly once, from whichever path finishes first.
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          synthesizer.close();
        } catch {
          /* already closed */
        }
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
        buildSsml(text, voice, params, {
          rate: this.config.get<string>('AZURE_TTS_RATE'),
          pitch: this.config.get<string>('AZURE_TTS_PITCH'),
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
          finish(() =>
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
            }),
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
  const rate = String(params?.rate ?? defaults?.rate ?? '0%');
  const pitch = String(params?.pitch ?? defaults?.pitch ?? '0%');
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
