import { Injectable } from '@nestjs/common';
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

/** Default OpenAI chat model (JSON-mode capable). Override with OPENAI_LLM_MODEL. */
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

/**
 * OpenAI (GPT) implementation of {@link LlmAdapter}. Uses the REST API directly
 * (the rest of the codebase calls OpenAI via fetch too — no SDK) and turns on
 * JSON mode so the buddy contract parses reliably (the system prompt already
 * says "Return valid JSON only", which JSON mode requires).
 */
@Injectable()
export class OpenAiLlmAdapter implements LlmAdapter {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('OPENAI_API_KEY', '');
    this.model = config.get<string>('OPENAI_LLM_MODEL', DEFAULT_OPENAI_MODEL);
  }

  async complete(
    system: string,
    messages: LlmMessage[],
    maxTokens: number,
  ): Promise<LlmResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' }, // force valid JSON for the contract
        messages: [{ role: 'system', content: system }, ...messages],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI LLM ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: data.choices?.[0]?.message?.content ?? '',
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      model: this.model,
    };
  }
}
