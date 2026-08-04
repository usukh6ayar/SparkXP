/**
 * AI Buddy character definitions.
 * Stats tracking uses AiUsage.metadata.buddySlug = buddy.slug.
 * When mobile implements buddy selection, it passes buddySlug to the chat
 * endpoint and the gateway stores it in metadata.
 *
 * On every server start the gateway syncs the DB to this list:
 *   - New slugs are inserted.
 *   - Existing slugs are updated (name/title/prompt etc).
 *   - DB rows whose slug is no longer here are deleted.
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
    extraMessagesAmount: number;
    extraMessagesCost: number;
    voiceMinuteCost: number | null;
  };
}

export const AI_BUDDIES: BuddyDefinition[] = [
  {
    // First in the list → mobile auto-selects it; this is the flagship buddy
    // with the 3D avatar. avatar_asset_url is set from admin/DB, not here —
    // syncBuddiesFromFile never touches the avatar/voice columns.
    slug: 'police',
    name: 'Цагдаа Батбаяр',
    title: 'Цагдаагийн ахлах байцаагч',
    description: 'Хууль сахиулах Англи хэл — мэдүүлэг авах, замын хөдөлгөөн, аюулгүй байдлын нэр томьёо',
    emoji: '👮',
    systemPrompt:
      'Та SparkXP платформын "Цагдаа Батбаяр" гэдэг AI туслах. ' +
      'Та цагдаагийн ахлах байцаагч дүрд тоглон, хууль сахиулах салбарын Англи хэлийг заана. ' +
      'Мэдүүлэг авах, замын хөдөлгөөн, иргэдтэй харилцах, аюулгүй байдлын нэр томьёог тайлбарла. ' +
      'Монгол болон Англи хэлийг хольж тайлбарла.',
    pricing: { extraMessagesAmount: 50, extraMessagesCost: 5000, voiceMinuteCost: 200 },
  },
  // NOTE: only `police` ships as the default seed. More buddies are added/
  // edited/deleted from the admin panel (durable — the sync only *seeds* missing
  // slugs on an empty DB, it never overwrites or deletes admin-managed rows).
];
