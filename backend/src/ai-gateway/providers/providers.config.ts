import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TTS_ADAPTER } from './tts.adapter';
import {
  LLM_ADAPTER,
  AnthropicLlmAdapter,
  OpenAiLlmAdapter,
} from './llm.adapter';
import { GeminiLlmAdapter } from './gemini-llm.adapter';
import { STT_ADAPTER } from './stt.adapter';
import { GeminiSttAdapter } from './gemini-stt.adapter';
import { AzureFastSttAdapter } from './azure-stt.adapter';
import { FallbackSttAdapter } from './fallback-stt.adapter';
import { GeminiTtsAdapter } from './gemini-tts.adapter';
import { AzureTtsAdapter } from './azure-tts.adapter';

/**
 * Provider selection is config-driven (docx: never hardcode providers). Each
 * kind resolves its adapter from an env var. STT runs on **Gemini** (Azure Fast
 * Transcription is implemented and faster, but rate-limited — see the branch); TTS is
 * Gemini by default and **Azure** (`TTS_PROVIDER=azure`) when lip-sync timing is
 * wanted — Azure is the only provider here that reports visemes. ElevenLabs has
 * been removed. Adding another provider = add a branch here; nothing else
 * changes because callers depend only on the interface + DI token.
 *
 * ⚠️ Анхдагчууд нь **хуучин** тохиргоог хадгална (TTS=gemini, LLM=anthropic) —
 * шинэ сонголтыг env-ээр асаана. Ингэснээр энэ файл нь ямар ч орчинд зан
 * төлөвөө чимээгүй өөрчлөхгүй; `.env` / Railway л шийднэ.
 */
const logger = new Logger('AiProviders');

/**
 * Хэрэглэгдэж буй провайдерыг эхлэхэд нэг мөрөөр хэлнэ.
 *
 * Яагаад хэрэгтэй вэ: сонголт бүхэлдээ env-ээр явдаг ба анхдагч нь ХУУЧИН
 * утга. Тиймээс Railway дээр `TTS_PROVIDER` тавихаа мартвал систем алдаа
 * заахгүй, зүгээр л Gemini-гээр ярина — аудио гарсаар байх тул бүх зүйл
 * ажиллаж байгаа мэт харагдана, зөвхөн viseme (уруул синк) чимээгүй алга
 * болно. Энэ мөр нь тэр төрлийн доголдлыг логоос шууд харуулна.
 */
function announce(kind: string, chosen: string, requested?: string): void {
  logger.log(
    `${kind} = ${chosen}` +
      (requested && requested !== chosen ? ` (хүсэлт: "${requested}")` : ''),
  );
}

export const aiProviders: Provider[] = [
  GeminiTtsAdapter,
  AzureTtsAdapter,
  GeminiSttAdapter,
  AzureFastSttAdapter,
  AnthropicLlmAdapter,
  OpenAiLlmAdapter,
  GeminiLlmAdapter,
  {
    provide: TTS_ADAPTER,
    inject: [ConfigService, GeminiTtsAdapter, AzureTtsAdapter],
    useFactory: (
      config: ConfigService,
      gemini: GeminiTtsAdapter,
      azure: AzureTtsAdapter,
    ) => {
      const provider = config.get<string>('TTS_PROVIDER', 'gemini');
      const chosen = provider === 'azure' ? 'azure' : 'gemini';
      announce('TTS_PROVIDER', chosen, provider);
      // Azure бол viseme (уруул синк) өгдөг ЦОРЫН ГАНЦ провайдер. Түлхүүр нь
      // тохируулагдсан атлаа сонгогдоогүй байх нь бараг үргэлж мартагдсан env
      // — аппын lip-sync чимээгүй унтарна.
      if (chosen !== 'azure' && config.get<string>('AZURE_SPEECH_KEY')) {
        logger.warn(
          'AZURE_SPEECH_KEY тохируулагдсан атлаа TTS_PROVIDER=azure биш — ' +
            'viseme ирэхгүй тул 3D buddy-гийн уруул синк ажиллахгүй.',
        );
      }
      return chosen === 'azure' ? azure : gemini;
    },
  },
  {
    provide: LLM_ADAPTER,
    inject: [
      ConfigService,
      AnthropicLlmAdapter,
      OpenAiLlmAdapter,
      GeminiLlmAdapter,
    ],
    useFactory: (
      config: ConfigService,
      anthropic: AnthropicLlmAdapter,
      openai: OpenAiLlmAdapter,
      gemini: GeminiLlmAdapter,
    ) => {
      const provider = config.get<string>('LLM_PROVIDER', 'anthropic');
      switch (provider) {
        case 'gemini':
          announce('LLM_PROVIDER', 'gemini');
          return gemini;
        case 'openai':
          announce('LLM_PROVIDER', 'openai');
          return openai;
        case 'anthropic':
        default:
          announce('LLM_PROVIDER', 'anthropic', provider);
          return anthropic;
      }
    },
  },
  {
    provide: STT_ADAPTER,
    inject: [ConfigService, GeminiSttAdapter, AzureFastSttAdapter],
    useFactory: (
      config: ConfigService,
      gemini: GeminiSttAdapter,
      azure: AzureFastSttAdapter,
    ) => {
      const provider = config.get<string>('STT_PROVIDER', 'gemini');
      switch (provider) {
        case 'azure':
          // Azure нь ~1.2 сек хурдан (p50 281 vs 1524мс) ба нарийвчлал ижил,
          // ХАРИН одоогийн Speech нөөц дээр **20 хүсэлт/минут** (хэмжсэн) —
          // ойролцоогоор 5–6 сурагч зэрэг ярихад л дүүрнэ. Тиймээс quota
          // нэмэгдтэл анхдагч БИШ, мөн Gemini рүү унах хамгаалалттай:
          // 429/5xx дээр turn алдагдахгүй, зөвхөн удаан болно.
          announce('STT_PROVIDER', 'azure→gemini fallback');
          return new FallbackSttAdapter(azure, gemini, 'azure');
        case 'gemini':
        default:
          announce('STT_PROVIDER', 'gemini', provider);
          return gemini;
      }
    },
  },
];
