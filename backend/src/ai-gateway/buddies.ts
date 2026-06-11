/**
 * AI Buddy character definitions.
 * Stats tracking uses AiUsage.metadata.buddySlug = buddy.slug.
 * When mobile implements buddy selection, it passes buddySlug to the chat
 * endpoint and the gateway stores it in metadata.
 */

export interface BuddyDefinition {
  slug: string;
  /** Display name in Mongolian. */
  name: string;
  /** Job title / role in Mongolian. */
  title: string;
  /** Short description — what kind of English they teach. */
  description: string;
  /** Emoji avatar used before actual character images are ready. */
  emoji: string;
  /** The system prompt to use when this buddy is active. */
  systemPrompt: string;
  /**
   * Sample AI buddy pricing (separate from subscription plan).
   * Informational only — not enforced in code until Phase 3.
   */
  pricing: {
    /** Extra messages per top-up pack (e.g. 50 messages for 5,000 ₮). */
    extraMessagesAmount: number;
    extraMessagesCost: number;
    voiceMinuteCost: number | null;
  };
}

export const AI_BUDDIES: BuddyDefinition[] = [
  {
    slug: 'cop',
    name: 'Цагдаа Болд',
    title: 'Цагдаагийн дарга',
    description: 'Хуулийн болон албан ёсны Англи хэл — хэрэгт хамааралтай нэр томьёо, засаг захиргааны ярилцлага',
    emoji: '🚔',
    systemPrompt:
      'Та EnglishXP платформын "Цагдаа Болд" гэдэг AI туслах. ' +
      'Та цагдаагийн алба хаагч дүрд тоглон, хуулийн болон албан ёсны Англи хэлийг заана. ' +
      'Хариултаа тодорхой, найрсаг, мэргэжлийн байлга. ' +
      'Монгол болон Англи хэлийг хольж тайлбарла.',
    pricing: {
      extraMessagesAmount: 50,
      extraMessagesCost: 5000,
      voiceMinuteCost: 200,
    },
  },
  {
    slug: 'doctor',
    name: 'Эмч Сарнай',
    title: 'Эмнэлгийн эмч',
    description: 'Эмнэлгийн болон эрүүл мэндийн Англи хэл — оношлогооны нэр томьёо, өвчтөнтэй ярилцлага',
    emoji: '🏥',
    systemPrompt:
      'Та EnglishXP платформын "Эмч Сарнай" гэдэг AI туслах. ' +
      'Та эмч дүрд тоглон, эмнэлгийн болон эрүүл мэндийн Англи хэлийг заана. ' +
      'Хариултаа тодорхой, энэрэнгүй, мэргэжлийн байлга. ' +
      'Монгол болон Англи хэлийг хольж тайлбарла.',
    pricing: {
      extraMessagesAmount: 50,
      extraMessagesCost: 5000,
      voiceMinuteCost: 200,
    },
  },
];
