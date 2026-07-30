/**
 * AI-generated trophy catalog (100 badges on Cloudflare R2, by tier).
 * Image URLs are NOT stored here: both sizes live at
 * trophies/{full,thumb}/<slug>.webp, so AchievementsService derives them
 * from the slug. Only the slug must stay stable.
 * `slug` = stable id, also the key stored in `user_trophies` when earned.
 *
 * Thresholds are deliberately data, not logic: tuning one is a one-line edit
 * here, and `conditions.spec.ts` asserts they rise with tier.
 */
import { BuddySessionMode } from '../common/enums';
import type { TrophyCondition } from './conditions';

export type TrophyTier =
  | 'starter'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'sapphire'
  | 'crystal'
  | 'ruby'
  | 'emerald'
  | 'mythic'
  | 'celestial';

export interface Trophy {
  slug: string;
  tier: TrophyTier;
  name: string;
  /** Unlock rule. `null` = not trackable yet; the UI shows it as "coming soon". */
  condition: TrophyCondition | null;
}

/** Tier display order (low → high). */
export const TROPHY_TIERS: TrophyTier[] = [
  'starter',
  'bronze',
  'silver',
  'gold',
  'sapphire',
  'crystal',
  'ruby',
  'emerald',
  'mythic',
  'celestial',
];

export const TROPHY_CATALOG: Trophy[] = [
  {
    slug: 'starter_comeback_paw',
    tier: 'starter',
    name: 'Comeback Paw',
    condition: { type: 'streak_days', value: 2 },
  },
  {
    slug: 'starter_first_quiz',
    tier: 'starter',
    name: 'First Quiz',
    condition: { type: 'quiz_count', value: 1 },
  },
  {
    slug: 'starter_first_spark',
    tier: 'starter',
    name: 'First Spark',
    condition: { type: 'sparks_total', value: 1 },
  },
  {
    slug: 'starter_first_swipe',
    tier: 'starter',
    name: 'First Swipe',
    condition: { type: 'cards_swiped', value: 1 },
  },
  {
    slug: 'starter_first_voice',
    tier: 'starter',
    name: 'First Voice',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 1,
    },
  },
  {
    slug: 'starter_first_word',
    tier: 'starter',
    name: 'First Word',
    condition: { type: 'words_learned', value: 1 },
  },
  {
    slug: 'starter_grammer_badge',
    tier: 'starter',
    name: 'Grammer Badge',
    condition: { type: 'quiz_count', skill: 'fill', value: 1 },
  },
  {
    slug: 'starter_hello_buddy',
    tier: 'starter',
    name: 'Hello Buddy',
    condition: { type: 'buddy_sessions', value: 1 },
  },
  {
    slug: 'starter_mini_listener',
    tier: 'starter',
    name: 'Mini Listener',
    condition: { type: 'quiz_count', skill: 'listening', value: 1 },
  },
  {
    slug: 'starter_one_more_try',
    tier: 'starter',
    name: 'One More Try',
    condition: { type: 'mistakes_fixed', value: 1 },
  },
  {
    slug: 'bronze_brave_speaker',
    tier: 'bronze',
    name: 'Brave Speaker',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 5,
    },
  },
  {
    slug: 'bronze_buddy_bond',
    tier: 'bronze',
    name: 'Buddy Bond',
    condition: { type: 'buddy_sessions', value: 10 },
  },
  {
    slug: 'bronze_card_starter',
    tier: 'bronze',
    name: 'Card Starter',
    condition: { type: 'cards_swiped', value: 50 },
  },
  {
    slug: 'bronze_image_guesser',
    tier: 'bronze',
    name: 'Image Guesser',
    condition: { type: 'quiz_count', value: 5 },
  },
  {
    slug: 'bronze_mistake_fixer',
    tier: 'bronze',
    name: 'Mistake Fixer',
    condition: { type: 'mistakes_fixed', value: 5 },
  },
  {
    slug: 'bronze_pronounciation_rookie',
    tier: 'bronze',
    name: 'Pronounciation Rookie',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 10,
    },
  },
  {
    slug: 'bronze_quiz_rookie',
    tier: 'bronze',
    name: 'Quiz Rookie',
    condition: { type: 'quiz_count', value: 10 },
  },
  {
    slug: 'bronze_sentence_maker',
    tier: 'bronze',
    name: 'Sentence Maker',
    condition: { type: 'quiz_count', skill: 'writing', value: 5 },
  },
  {
    slug: 'bronze_weekly_flame',
    tier: 'bronze',
    name: 'Weekly Flame',
    condition: { type: 'streak_days', value: 7 },
  },
  {
    slug: 'bronze_word_paw',
    tier: 'bronze',
    name: 'Word Paw',
    condition: { type: 'words_learned', value: 25 },
  },
  {
    slug: 'silver_buddy_bond2',
    tier: 'silver',
    name: 'Buddy Bond2',
    condition: { type: 'buddy_sessions', value: 25 },
  },
  {
    slug: 'silver_card_hunter',
    tier: 'silver',
    name: 'Card Hunter',
    condition: { type: 'cards_swiped', value: 200 },
  },
  {
    slug: 'silver_discipline_paw',
    tier: 'silver',
    name: 'Discipline Paw',
    condition: { type: 'streak_days', value: 14 },
  },
  {
    slug: 'silver_emotion_speaker',
    tier: 'silver',
    name: 'Emotion Speaker',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 25,
    },
  },
  {
    slug: 'silver_grammar_builder1',
    tier: 'silver',
    name: 'Grammar Builder1',
    condition: { type: 'quiz_count', skill: 'fill', value: 10 },
  },
  {
    slug: 'silver_listening_builder1',
    tier: 'silver',
    name: 'Listening Builder1',
    condition: { type: 'quiz_count', skill: 'listening', value: 10 },
  },
  {
    slug: 'silver_perfect_five',
    tier: 'silver',
    name: 'Perfect Five',
    condition: { type: 'quiz_perfect', value: 5 },
  },
  {
    slug: 'silver_quiz_figther',
    tier: 'silver',
    name: 'Quiz Figther',
    condition: { type: 'quiz_count', value: 25 },
  },
  {
    slug: 'silver_voice_builder',
    tier: 'silver',
    name: 'Voice Builder',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 20,
    },
  },
  {
    slug: 'silver_word_hunter',
    tier: 'silver',
    name: 'Word Hunter',
    condition: { type: 'words_learned', value: 100 },
  },
  {
    slug: 'gold_a1_finisher',
    tier: 'gold',
    name: 'A1 Finisher',
    condition: null,
  },
  {
    slug: 'gold_card_collector1',
    tier: 'gold',
    name: 'Card Collector1',
    condition: { type: 'cards_swiped', value: 500 },
  },
  {
    slug: 'gold_conversation_figther',
    tier: 'gold',
    name: 'Conversation Figther',
    condition: { type: 'buddy_sessions', value: 50 },
  },
  {
    slug: 'gold_grammar_builder2',
    tier: 'gold',
    name: 'Grammar Builder2',
    condition: { type: 'quiz_count', skill: 'fill', value: 25 },
  },
  {
    slug: 'gold_listening_builder2',
    tier: 'gold',
    name: 'Listening Builder2',
    condition: { type: 'quiz_count', skill: 'listening', value: 25 },
  },
  {
    slug: 'gold_mistake_slayer1',
    tier: 'gold',
    name: 'Mistake Slayer1',
    condition: { type: 'mistakes_fixed', value: 25 },
  },
  {
    slug: 'gold_monthly_grinder',
    tier: 'gold',
    name: 'Monthly Grinder',
    condition: { type: 'streak_days', value: 30 },
  },
  {
    slug: 'gold_perfect_ten',
    tier: 'gold',
    name: 'Perfect Ten',
    condition: { type: 'quiz_perfect', value: 10 },
  },
  {
    slug: 'gold_quiz_veteran',
    tier: 'gold',
    name: 'Quiz Veteran',
    condition: { type: 'quiz_count', value: 50 },
  },
  {
    slug: 'gold_word_collector',
    tier: 'gold',
    name: 'Word Collector',
    condition: { type: 'words_learned', value: 250 },
  },
  {
    slug: 'sapphire_a1_grammar_master',
    tier: 'sapphire',
    name: 'A1 Grammar Master',
    condition: { type: 'quiz_count', skill: 'fill', value: 50 },
  },
  {
    slug: 'sapphire_a2_finisher',
    tier: 'sapphire',
    name: 'A2 Finisher',
    condition: null,
  },
  {
    slug: 'sapphire_a2_grammar_master',
    tier: 'sapphire',
    name: 'A2 Grammar Master',
    condition: { type: 'quiz_count', skill: 'fill', value: 75 },
  },
  {
    slug: 'sapphire_card_collector',
    tier: 'sapphire',
    name: 'Card Collector',
    condition: { type: 'cards_swiped', value: 1000 },
  },
  {
    slug: 'sapphire_fluency_engine',
    tier: 'sapphire',
    name: 'Fluency Engine',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 50,
    },
  },
  {
    slug: 'sapphire_iron_habit',
    tier: 'sapphire',
    name: 'Iron Habit',
    condition: { type: 'streak_days', value: 60 },
  },
  {
    slug: 'sapphire_listening_master',
    tier: 'sapphire',
    name: 'Listening Master',
    condition: { type: 'quiz_count', skill: 'listening', value: 50 },
  },
  {
    slug: 'sapphire_perfect_twenty',
    tier: 'sapphire',
    name: 'Perfect Twenty',
    condition: { type: 'quiz_perfect', value: 20 },
  },
  {
    slug: 'sapphire_quiz_architect',
    tier: 'sapphire',
    name: 'Quiz Architect',
    condition: { type: 'quiz_count', value: 100 },
  },
  {
    slug: 'sapphire_quiz_champion',
    tier: 'sapphire',
    name: 'Quiz Champion',
    condition: { type: 'quiz_perfect', value: 25 },
  },
  {
    slug: 'crystal_b1_finisher',
    tier: 'crystal',
    name: 'B1 Finisher',
    condition: null,
  },
  {
    slug: 'crystal_buddy_loyalist',
    tier: 'crystal',
    name: 'Buddy Loyalist',
    condition: { type: 'buddy_sessions', value: 100 },
  },
  {
    slug: 'crystal_fluency_engine2',
    tier: 'crystal',
    name: 'Fluency Engine2',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 100,
    },
  },
  {
    slug: 'crystal_grammar_master3',
    tier: 'crystal',
    name: 'Grammar Master3',
    condition: { type: 'quiz_count', skill: 'fill', value: 100 },
  },
  {
    slug: 'crystal_iron_habit2',
    tier: 'crystal',
    name: 'Iron Habit2',
    condition: { type: 'streak_days', value: 90 },
  },
  {
    slug: 'crystal_listening_master2',
    tier: 'crystal',
    name: 'Listening Master2',
    condition: { type: 'quiz_count', skill: 'listening', value: 100 },
  },
  {
    slug: 'crystal_mistake_slayer_2',
    tier: 'crystal',
    name: 'Mistake Slayer 2',
    condition: { type: 'mistakes_fixed', value: 50 },
  },
  {
    slug: 'crystal_quiz_champion2',
    tier: 'crystal',
    name: 'Quiz Champion2',
    condition: { type: 'quiz_perfect', value: 40 },
  },
  {
    slug: 'crystal_rare_card_hunter',
    tier: 'crystal',
    name: 'Rare Card Hunter',
    condition: { type: 'words_saved', value: 50 },
  },
  {
    slug: 'crystal_word_master1',
    tier: 'crystal',
    name: 'Word Master1',
    condition: { type: 'words_mature', value: 100 },
  },
  {
    slug: 'ruby_buddy_soul_mate',
    tier: 'ruby',
    name: 'Buddy Soul Mate',
    condition: { type: 'buddy_sessions', value: 200 },
  },
  {
    slug: 'ruby_card_legend1',
    tier: 'ruby',
    name: 'Card Legend1',
    condition: { type: 'cards_swiped', value: 2500 },
  },
  {
    slug: 'ruby_fluency_trial1',
    tier: 'ruby',
    name: 'Fluency Trial1',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 150,
    },
  },
  {
    slug: 'ruby_grammar_complationist',
    tier: 'ruby',
    name: 'Grammar Complationist',
    condition: { type: 'quiz_count', skill: 'fill', value: 150 },
  },
  {
    slug: 'ruby_half_year_spark',
    tier: 'ruby',
    name: 'Half Year Spark',
    condition: { type: 'streak_days', value: 180 },
  },
  {
    slug: 'ruby_lexicon_beast1',
    tier: 'ruby',
    name: 'Lexicon Beast1',
    condition: { type: 'words_learned', value: 1000 },
  },
  {
    slug: 'ruby_listening_master_4',
    tier: 'ruby',
    name: 'Listening Master 4',
    condition: { type: 'quiz_count', skill: 'listening', value: 150 },
  },
  {
    slug: 'ruby_no_translation_needed_2',
    tier: 'ruby',
    name: 'No Translation Needed 2',
    condition: { type: 'words_mature', value: 250 },
  },
  {
    slug: 'ruby_quiz_legend1',
    tier: 'ruby',
    name: 'Quiz Legend1',
    condition: { type: 'quiz_count', value: 250 },
  },
  {
    slug: 'ruby_xp_beast',
    tier: 'ruby',
    name: 'Xp Beast',
    condition: { type: 'xp_total', value: 50000 },
  },
  {
    slug: 'emerald_b2_finisher',
    tier: 'emerald',
    name: 'B2 Finisher',
    condition: null,
  },
  {
    slug: 'emerald_epic_card_hunter',
    tier: 'emerald',
    name: 'Epic Card Hunter',
    condition: { type: 'words_saved', value: 150 },
  },
  {
    slug: 'emerald_grammar_master4',
    tier: 'emerald',
    name: 'Grammar Master4',
    condition: { type: 'quiz_count', skill: 'fill', value: 250 },
  },
  {
    slug: 'emerald_hundred_day_fox',
    tier: 'emerald',
    name: 'Hundred Day Fox',
    // 240, not the 100 the name suggests: emerald sits above ruby, whose
    // Half Year Spark is already 180. Tier order wins over the badge wording.
    condition: { type: 'streak_days', value: 240 },
  },
  {
    slug: 'emerald_listening_master3',
    tier: 'emerald',
    name: 'Listening Master3',
    condition: { type: 'quiz_count', skill: 'listening', value: 250 },
  },
  {
    slug: 'emerald_mistake_slayer3',
    tier: 'emerald',
    name: 'Mistake Slayer3',
    condition: { type: 'mistakes_fixed', value: 150 },
  },
  {
    slug: 'emerald_no_translation_needed1',
    tier: 'emerald',
    name: 'No Translation Needed1',
    condition: { type: 'words_mature', value: 500 },
  },
  {
    slug: 'emerald_perfect_fifty',
    tier: 'emerald',
    name: 'Perfect Fifty',
    condition: { type: 'quiz_perfect', value: 50 },
  },
  {
    slug: 'emerald_quiz_champion3',
    tier: 'emerald',
    name: 'Quiz Champion3',
    condition: { type: 'quiz_perfect', value: 75 },
  },
  {
    slug: 'emerald_word_master3',
    tier: 'emerald',
    name: 'Word Master3',
    condition: { type: 'words_mature', value: 750 },
  },
  {
    slug: 'mythic_ai_circle_master',
    tier: 'mythic',
    name: 'Ai Circle Master',
    condition: { type: 'buddy_distinct', value: 5 },
  },
  {
    slug: 'mythic_card_legend2',
    tier: 'mythic',
    name: 'Card Legend2',
    condition: { type: 'cards_swiped', value: 5000 },
  },
  {
    slug: 'mythic_english_xp_champion',
    tier: 'mythic',
    name: 'English Xp Champion',
    condition: { type: 'xp_total', value: 250000 },
  },
  {
    slug: 'mythic_fluency_trial2',
    tier: 'mythic',
    name: 'Fluency Trial2',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 300,
    },
  },
  {
    slug: 'mythic_fluent_fox1',
    tier: 'mythic',
    name: 'Fluent Fox1',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 250,
    },
  },
  {
    slug: 'mythic_grand_collector1',
    tier: 'mythic',
    name: 'Grand Collector1',
    condition: { type: 'words_saved', value: 300 },
  },
  {
    slug: 'mythic_lexicon_beast2',
    tier: 'mythic',
    name: 'Lexicon Beast2',
    condition: { type: 'words_learned', value: 2500 },
  },
  {
    slug: 'mythic_living_dictionary',
    tier: 'mythic',
    name: 'Living Dictionary',
    condition: { type: 'words_mature', value: 1500 },
  },
  {
    slug: 'mythic_mistake_slayer4',
    tier: 'mythic',
    name: 'Mistake Slayer4',
    condition: { type: 'mistakes_fixed', value: 300 },
  },
  {
    slug: 'mythic_one_year_spark',
    tier: 'mythic',
    name: 'One Year Spark',
    condition: { type: 'streak_days', value: 365 },
  },
  {
    slug: 'mythic_quiz_legend2',
    tier: 'mythic',
    name: 'Quiz Legend2',
    condition: { type: 'quiz_count', value: 500 },
  },
  {
    slug: 'celestial_eternal_habit',
    tier: 'celestial',
    name: 'Eternal Habit',
    condition: { type: 'streak_days', value: 730 },
  },
  {
    slug: 'celestial_fluency_trial3',
    tier: 'celestial',
    name: 'Fluency Trial3',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 500,
    },
  },
  {
    slug: 'celestial_fluent_fox2',
    tier: 'celestial',
    name: 'Fluent Fox2',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 750,
    },
  },
  {
    slug: 'celestial_grand_collector3',
    tier: 'celestial',
    name: 'Grand Collector3',
    condition: { type: 'words_saved', value: 1000 },
  },
  {
    slug: 'celestial_legend_card3',
    tier: 'celestial',
    name: 'Legend Card3',
    condition: { type: 'cards_swiped', value: 10000 },
  },
  {
    slug: 'celestial_mistake_destroyer',
    tier: 'celestial',
    name: 'Mistake Destroyer',
    condition: { type: 'mistakes_fixed', value: 1000 },
  },
  {
    slug: 'celestial_quiz_immortal',
    tier: 'celestial',
    name: 'Quiz Immortal',
    condition: { type: 'quiz_count', value: 1000 },
  },
  {
    slug: 'celestial_the_crowned_fox',
    tier: 'celestial',
    name: 'The Crowned Fox',
    condition: { type: 'trophy_count', value: 90 },
  },
  {
    slug: 'celestial_the_eternal_spark',
    tier: 'celestial',
    name: 'The Eternal Spark',
    condition: { type: 'xp_total', value: 10000000 },
  },
];
