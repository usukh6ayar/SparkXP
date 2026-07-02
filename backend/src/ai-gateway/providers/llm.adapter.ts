import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
}

/**
 * Chat completion. The single seam for swapping the LLM provider. Buddy turns
 * ask for JSON output via the system prompt; parsing/validation is the caller's
 * job (see buddy-contract.ts).
 */
export interface LlmAdapter {
  complete(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResult>;
}

/** DI token for the active LLM adapter. */
export const LLM_ADAPTER = 'LLM_ADAPTER';

/** Haiku is fast and cheap for chat. Override with AI_MODEL. */
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

/** Anthropic (Claude) implementation of {@link LlmAdapter}. */
@Injectable()
export class AnthropicLlmAdapter implements LlmAdapter {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly logger = new Logger(AnthropicLlmAdapter.name);

  constructor(config: ConfigService) {
    this.client = new Anthropic({ apiKey: config.get<string>('ANTHROPIC_API_KEY') });
    this.model = config.get<string>('AI_MODEL', DEFAULT_MODEL);
  }

  async complete(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: maxTokens,
      system,
      messages: messages as Anthropic.MessageParam[],
    });
    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return {
      text,
      promptTokens: response.usage.input_tokens,
      completionTokens: response.usage.output_tokens,
      model: this.model,
    };
  }
}
