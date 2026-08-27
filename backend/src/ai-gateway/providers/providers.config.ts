import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TTS_ADAPTER } from './tts.adapter';
import {
  LLM_ADAPTER,
  AnthropicLlmAdapter,
  OpenAiLlmAdapter,
} from './llm.adapter';
import { STT_ADAPTER } from './stt.adapter';
import { GeminiSttAdapter } from './gemini-stt.adapter';
import { GeminiTtsAdapter } from './gemini-tts.adapter';
import { AzureTtsAdapter } from './azure-tts.adapter';

/**
 * Provider selection is config-driven (docx: never hardcode providers). Each
 * kind resolves its adapter from an env var. STT runs on **Gemini**; TTS is
 * Gemini by default and **Azure** (`TTS_PROVIDER=azure`) when lip-sync timing is
 * wanted — Azure is the only provider here that reports visemes. ElevenLabs has
 * been removed. Adding another provider = add a branch here; nothing else
 * changes because callers depend only on the interface + DI token.
 */
export const aiProviders: Provider[] = [
  GeminiTtsAdapter,
  AzureTtsAdapter,
  GeminiSttAdapter,
  AnthropicLlmAdapter,
  OpenAiLlmAdapter,
  {
    provide: TTS_ADAPTER,
    inject: [ConfigService, GeminiTtsAdapter, AzureTtsAdapter],
    useFactory: (
      config: ConfigService,
      gemini: GeminiTtsAdapter,
      azure: AzureTtsAdapter,
    ) => {
      const provider = config.get<string>('TTS_PROVIDER', 'gemini');
      switch (provider) {
        case 'azure':
          return azure;
        case 'gemini':
        default:
          return gemini;
      }
    },
  },
  {
    provide: LLM_ADAPTER,
    inject: [ConfigService, AnthropicLlmAdapter, OpenAiLlmAdapter],
    useFactory: (
      config: ConfigService,
      anthropic: AnthropicLlmAdapter,
      openai: OpenAiLlmAdapter,
    ) => {
      const provider = config.get<string>('LLM_PROVIDER', 'anthropic');
      switch (provider) {
        case 'openai':
          return openai;
        case 'anthropic':
        default:
          return anthropic;
      }
    },
  },
  {
    provide: STT_ADAPTER,
    inject: [ConfigService, GeminiSttAdapter],
    useFactory: (config: ConfigService, gemini: GeminiSttAdapter) => {
      const provider = config.get<string>('STT_PROVIDER', 'gemini');
      switch (provider) {
        case 'gemini':
        default:
          return gemini;
      }
    },
  },
];
