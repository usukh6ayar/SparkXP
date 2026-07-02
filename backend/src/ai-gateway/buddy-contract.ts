import { BUDDY_EMOTIONS, BUDDY_GESTURES, BuddyMemoryType } from '../common/enums';
import type { AiBuddy } from '../entities/ai-buddy.entity';

/**
 * The AI Buddy LLM must return exactly this JSON shape (docx §5). Parsing it
 * lets TTS, the avatar, corrections UI, and memory all run on stable data.
 */
export interface BuddyTurnResult {
  reply_text: string;
  correction: {
    has_correction: boolean;
    original: string;
    corrected: string;
    short_explanation: string;
  };
  follow_up_question: string;
  emotion: string;
  gesture: string;
  cefr_level_used: string;
  memory_update: {
    should_save: boolean;
    memory_type: BuddyMemoryType;
    value: string;
  };
  safety: { flagged: boolean; reason: string | null };
}

/** Hard cap on spoken reply length (~15s of speech). Also enforced at runtime. */
export const MAX_REPLY_CHARS = 280;

/** Returned when the LLM output can't be salvaged after one retry. */
export const FALLBACK_TURN: BuddyTurnResult = {
  reply_text: "Sorry, I got stuck for a second. Let's try again!",
  correction: { has_correction: false, original: '', corrected: '', short_explanation: '' },
  follow_up_question: 'What would you like to talk about?',
  emotion: 'calm',
  gesture: 'idle',
  cefr_level_used: 'B1',
  memory_update: { should_save: false, memory_type: BuddyMemoryType.INTEREST, value: '' },
  safety: { flagged: false, reason: null },
};

/**
 * Parse + validate + coerce raw LLM text into a BuddyTurnResult. Strips markdown
 * fences, then normalizes: unknown emotion → `calm`, unknown gesture → `idle`,
 * over-long reply → truncated. Returns null only when JSON is unparseable or a
 * required field is missing/wrong-typed (caller then retries once, else falls
 * back). Never throws.
 */
export function parseBuddyTurn(raw: string): BuddyTurnResult | null {
  const json = stripFences(raw);
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, any>;

  if (typeof d.reply_text !== 'string' || d.reply_text.trim().length === 0) return null;
  if (typeof d.follow_up_question !== 'string') return null;
  if (typeof d.safety !== 'object' || d.safety === null) return null;

  const reply = d.reply_text.trim().slice(0, MAX_REPLY_CHARS);
  const correction = d.correction ?? {};
  const memory = d.memory_update ?? {};

  return {
    reply_text: reply,
    correction: {
      has_correction: Boolean(correction.has_correction),
      original: str(correction.original),
      corrected: str(correction.corrected),
      short_explanation: str(correction.short_explanation),
    },
    follow_up_question: d.follow_up_question.trim(),
    emotion: BUDDY_EMOTIONS.includes(d.emotion) ? d.emotion : 'calm',
    gesture: BUDDY_GESTURES.includes(d.gesture) ? d.gesture : 'idle',
    cefr_level_used: str(d.cefr_level_used) || 'B1',
    memory_update: {
      should_save: Boolean(memory.should_save),
      memory_type: isMemoryType(memory.memory_type)
        ? memory.memory_type
        : BuddyMemoryType.INTEREST,
      value: str(memory.value),
    },
    safety: {
      flagged: Boolean(d.safety.flagged),
      reason: d.safety.reason == null ? null : str(d.safety.reason),
    },
  };
}

/**
 * Compose the system prompt: buddy persona (from DB) + the docx mandatory rules
 * + the required JSON shape + the user's long-term memories.
 */
export function buildBuddySystemPrompt(
  buddy: Pick<AiBuddy, 'systemPrompt'>,
  cefr: string,
  memories: string[],
  topic?: string,
): string {
  const memoryBlock = memories.length
    ? `\nWhat you remember about this user:\n${memories.map((m) => `- ${m}`).join('\n')}`
    : '';
  const topicLine = topic ? `\nCurrent topic: ${topic}.` : '';

  return [
    buddy.systemPrompt,
    '',
    'You are SparkXP AI Buddy, a friendly English speaking practice partner.',
    `Always match the user CEFR level (${cefr}).`,
    'Keep the spoken reply short enough for 8–15 seconds of audio.',
    'Give only one correction per turn, unless the user asks for detailed correction.',
    'Always end with one natural follow-up question.',
    'Do not give long lectures. Do not over-explain grammar.',
    'If the user asks for medical, legal, or financial advice, or brings up self-harm',
    'or adult topics, set safety.flagged=true and gently redirect to English practice.',
    'Return valid JSON only. No markdown, no extra text outside JSON.',
    '',
    'Output exactly this JSON shape:',
    '{',
    '  "reply_text": "short natural reply (goes to text-to-speech)",',
    '  "correction": { "has_correction": bool, "original": "", "corrected": "", "short_explanation": "" },',
    '  "follow_up_question": "one short question",',
    `  "emotion": "one of: ${BUDDY_EMOTIONS.join('|')}",`,
    `  "gesture": "one of: ${BUDDY_GESTURES.join('|')}",`,
    '  "cefr_level_used": "A1|A2|B1|B2|C1|C2",',
    '  "memory_update": { "should_save": bool, "memory_type": "interest|goal|mistake_pattern|preference|level", "value": "" },',
    '  "safety": { "flagged": bool, "reason": null }',
    '}',
    topicLine + memoryBlock,
  ].join('\n');
}

function stripFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function isMemoryType(v: unknown): v is BuddyMemoryType {
  return (
    typeof v === 'string' &&
    (Object.values(BuddyMemoryType) as string[]).includes(v)
  );
}
