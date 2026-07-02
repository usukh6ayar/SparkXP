import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TTS_ADAPTER, ElevenLabsTtsAdapter } from './tts.adapter';
import { LLM_ADAPTER, AnthropicLlmAdapter } from './llm.adapter';
import { STT_ADAPTER, ElevenLabsSttAdapter } from './stt.adapter';

/**
 * Provider selection is config-driven (docx: never hardcode providers). Each
 * kind resolves its adapter from an env var, defaulting to the current vendor.
 * Adding a new provider = add a branch here; nothing else changes because
 * callers depend only on the interface + DI token.
 */
export const aiProviders: Provider[] = [
  ElevenLabsTtsAdapter,
  AnthropicLlmAdapter,
  ElevenLabsSttAdapter,
  {
    provide: TTS_ADAPTER,
    inject: [ConfigService, ElevenLabsTtsAdapter],
    useFactory: (config: ConfigService, elevenlabs: ElevenLabsTtsAdapter) => {
      const provider = config.get<string>('TTS_PROVIDER', 'elevenlabs');
      switch (provider) {
        case 'elevenlabs':
        default:
          return elevenlabs;
      }
    },
  },
  {
    provide: LLM_ADAPTER,
    inject: [ConfigService, AnthropicLlmAdapter],
    useFactory: (config: ConfigService, anthropic: AnthropicLlmAdapter) => {
      const provider = config.get<string>('LLM_PROVIDER', 'anthropic');
      switch (provider) {
        case 'anthropic':
        default:
          return anthropic;
      }
    },
  },
  {
    provide: STT_ADAPTER,
    inject: [ConfigService, ElevenLabsSttAdapter],
    useFactory: (config: ConfigService, elevenlabs: ElevenLabsSttAdapter) => {
      const provider = config.get<string>('STT_PROVIDER', 'elevenlabs');
      switch (provider) {
        case 'elevenlabs':
        default:
          return elevenlabs;
      }
    },
  },
];
