/**
 * Trophy catalog — 68 badges, cleaned up 2026-09-28 from the original 100.
 *
 * The cleanup rule: ONE ladder per stat, each step a real jump, every rule
 * trackable. What was dropped and why (`docs/TROPHIES.md` has the full table):
 *  - near-duplicate steps (voice sessions 5/10/20/25, "Quiz Champion" at the
 *    same stat as "Perfect N", three grammar/listening masters past 100);
 *  - out-of-reach thresholds (10,000,000 XP, a 730-day streak, 10,000 cards);
 *  - "saved words" — saving is a tap, not an achievement;
 *  - names with typos or bare numbers ("Grammer", "Figther", "Buddy Bond2").
 * A retired trophy a learner already earned stays in `user_trophies` but is no
 * longer shown or counted (AchievementsService filters by this catalog).
 *
 * Images live on Cloudflare R2, by tier.
 * Image URLs are NOT stored here: both sizes live at
 * trophies/{full,thumb}/<slug>.webp, so AchievementsService derives them
 * from the slug. Only the slug must stay stable.
 * `slug` = stable id, also the key stored in `user_trophies` when earned.
 *
 * Thresholds are deliberately data, not logic: tuning one is a one-line edit
 * here, and `conditions.spec.ts` asserts they rise with tier.
 */
import { BuddySessionMode, ContentLevel } from '../common/enums';
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
  /** English display name, Title Case, no numbers or typos. */
  name: string;
  /** Mongolian display name — what the app shows first. */
  nameMn: string;
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
    nameMn: 'Эргэн ирсэн сарвуу',
    condition: { type: 'streak_days', value: 3 },
  },
  {
    slug: 'bronze_weekly_flame',
    tier: 'bronze',
    name: 'Weekly Flame',
    nameMn: '7 хоногийн гал',
    condition: { type: 'streak_days', value: 7 },
  },
  {
    slug: 'silver_discipline_paw',
    tier: 'silver',
    name: 'Discipline Paw',
    nameMn: 'Тууштай сарвуу',
    condition: { type: 'streak_days', value: 14 },
  },
  {
    slug: 'gold_monthly_grinder',
    tier: 'gold',
    name: 'Monthly Grinder',
    nameMn: 'Сарын тэмцэгч',
    condition: { type: 'streak_days', value: 30 },
  },
  {
    slug: 'sapphire_iron_habit',
    tier: 'sapphire',
    name: 'Iron Habit',
    nameMn: 'Төмөр зуршил',
    condition: { type: 'streak_days', value: 60 },
  },
  {
    slug: 'crystal_iron_habit2',
    tier: 'crystal',
    name: 'Hundred Day Habit',
    nameMn: 'Зуун өдрийн зуршил',
    condition: { type: 'streak_days', value: 100 },
  },
  {
    slug: 'ruby_half_year_spark',
    tier: 'ruby',
    name: 'Half Year Spark',
    nameMn: 'Хагас жилийн оч',
    condition: { type: 'streak_days', value: 180 },
  },
  {
    slug: 'mythic_one_year_spark',
    tier: 'mythic',
    name: 'One Year Spark',
    nameMn: 'Нэг жилийн оч',
    condition: { type: 'streak_days', value: 365 },
  },
  {
    slug: 'gold_a1_finisher',
    tier: 'gold',
    name: 'A1 Finisher',
    nameMn: 'A1 арлыг туулагч',
    condition: { type: 'level_complete', level: ContentLevel.A1, value: 100 },
  },
  {
    slug: 'sapphire_a2_finisher',
    tier: 'sapphire',
    name: 'A2 Finisher',
    nameMn: 'A2 арлыг туулагч',
    condition: { type: 'level_complete', level: ContentLevel.A2, value: 100 },
  },
  {
    slug: 'crystal_b1_finisher',
    tier: 'crystal',
    name: 'B1 Finisher',
    nameMn: 'B1 арлыг туулагч',
    condition: { type: 'level_complete', level: ContentLevel.B1, value: 100 },
  },
  {
    slug: 'emerald_b2_finisher',
    tier: 'emerald',
    name: 'B2 Finisher',
    nameMn: 'B2 арлыг туулагч',
    condition: { type: 'level_complete', level: ContentLevel.B2, value: 100 },
  },
  {
    slug: 'starter_first_quiz',
    tier: 'starter',
    name: 'First Quiz',
    nameMn: 'Анхны сорил',
    condition: { type: 'quiz_count', value: 1 },
  },
  {
    slug: 'bronze_quiz_rookie',
    tier: 'bronze',
    name: 'Quiz Rookie',
    nameMn: 'Сорилын шинэхэн',
    condition: { type: 'quiz_count', value: 10 },
  },
  {
    slug: 'silver_quiz_figther',
    tier: 'silver',
    name: 'Quiz Fighter',
    nameMn: 'Сорилын тэмцэгч',
    condition: { type: 'quiz_count', value: 25 },
  },
  {
    slug: 'gold_quiz_veteran',
    tier: 'gold',
    name: 'Quiz Veteran',
    nameMn: 'Сорилын ахмад',
    condition: { type: 'quiz_count', value: 50 },
  },
  {
    slug: 'sapphire_quiz_architect',
    tier: 'sapphire',
    name: 'Quiz Architect',
    nameMn: 'Сорилын мастер',
    condition: { type: 'quiz_count', value: 100 },
  },
  {
    slug: 'ruby_quiz_legend1',
    tier: 'ruby',
    name: 'Quiz Legend',
    nameMn: 'Сорилын домог',
    condition: { type: 'quiz_count', value: 250 },
  },
  {
    slug: 'silver_perfect_five',
    tier: 'silver',
    name: 'Perfect Five',
    nameMn: 'Төгс тав',
    condition: { type: 'quiz_perfect', value: 5 },
  },
  {
    slug: 'gold_perfect_ten',
    tier: 'gold',
    name: 'Perfect Ten',
    nameMn: 'Төгс арав',
    condition: { type: 'quiz_perfect', value: 10 },
  },
  {
    slug: 'sapphire_perfect_twenty',
    tier: 'sapphire',
    name: 'Perfect Twenty',
    nameMn: 'Төгс хорь',
    condition: { type: 'quiz_perfect', value: 20 },
  },
  {
    slug: 'emerald_perfect_fifty',
    tier: 'emerald',
    name: 'Perfect Fifty',
    nameMn: 'Төгс тавь',
    condition: { type: 'quiz_perfect', value: 50 },
  },
  {
    slug: 'starter_grammer_badge',
    tier: 'starter',
    name: 'Grammar Badge',
    nameMn: 'Дүрмийн тэмдэг',
    condition: { type: 'quiz_count', skill: 'fill', value: 1 },
  },
  {
    slug: 'silver_grammar_builder1',
    tier: 'silver',
    name: 'Grammar Builder',
    nameMn: 'Дүрэм бүтээгч',
    condition: { type: 'quiz_count', skill: 'fill', value: 10 },
  },
  {
    slug: 'gold_grammar_builder2',
    tier: 'gold',
    name: 'Grammar Expert',
    nameMn: 'Дүрмийн мэргэжилтэн',
    condition: { type: 'quiz_count', skill: 'fill', value: 25 },
  },
  {
    slug: 'sapphire_a1_grammar_master',
    tier: 'sapphire',
    name: 'Grammar Master',
    nameMn: 'Дүрмийн мастер',
    condition: { type: 'quiz_count', skill: 'fill', value: 50 },
  },
  {
    slug: 'crystal_grammar_master3',
    tier: 'crystal',
    name: 'Grammar Legend',
    nameMn: 'Дүрмийн домог',
    condition: { type: 'quiz_count', skill: 'fill', value: 100 },
  },
  {
    slug: 'starter_mini_listener',
    tier: 'starter',
    name: 'Mini Listener',
    nameMn: 'Бяцхан сонсогч',
    condition: { type: 'quiz_count', skill: 'listening', value: 1 },
  },
  {
    slug: 'silver_listening_builder1',
    tier: 'silver',
    name: 'Listening Builder',
    nameMn: 'Сонсголын бүтээгч',
    condition: { type: 'quiz_count', skill: 'listening', value: 10 },
  },
  {
    slug: 'gold_listening_builder2',
    tier: 'gold',
    name: 'Listening Expert',
    nameMn: 'Сонсголын мэргэжилтэн',
    condition: { type: 'quiz_count', skill: 'listening', value: 25 },
  },
  {
    slug: 'sapphire_listening_master',
    tier: 'sapphire',
    name: 'Listening Master',
    nameMn: 'Сонсголын мастер',
    condition: { type: 'quiz_count', skill: 'listening', value: 50 },
  },
  {
    slug: 'crystal_listening_master2',
    tier: 'crystal',
    name: 'Listening Legend',
    nameMn: 'Сонсголын домог',
    condition: { type: 'quiz_count', skill: 'listening', value: 100 },
  },
  {
    slug: 'bronze_sentence_maker',
    tier: 'bronze',
    name: 'Sentence Maker',
    nameMn: 'Өгүүлбэр зохиогч',
    condition: { type: 'quiz_count', skill: 'writing', value: 5 },
  },
  {
    slug: 'starter_first_word',
    tier: 'starter',
    name: 'First Word',
    nameMn: 'Анхны үг',
    condition: { type: 'words_learned', value: 1 },
  },
  {
    slug: 'bronze_word_paw',
    tier: 'bronze',
    name: 'Word Paw',
    nameMn: 'Үгийн сарвуу',
    condition: { type: 'words_learned', value: 25 },
  },
  {
    slug: 'silver_word_hunter',
    tier: 'silver',
    name: 'Word Hunter',
    nameMn: 'Үгийн анчин',
    condition: { type: 'words_learned', value: 100 },
  },
  {
    slug: 'gold_word_collector',
    tier: 'gold',
    name: 'Word Collector',
    nameMn: 'Үг цуглуулагч',
    condition: { type: 'words_learned', value: 250 },
  },
  {
    slug: 'ruby_lexicon_beast1',
    tier: 'ruby',
    name: 'Lexicon Beast',
    nameMn: 'Үгийн баатар',
    condition: { type: 'words_learned', value: 1000 },
  },
  {
    slug: 'crystal_word_master1',
    tier: 'crystal',
    name: 'Word Master',
    nameMn: 'Үгийн мастер',
    condition: { type: 'words_mature', value: 100 },
  },
  {
    slug: 'ruby_no_translation_needed_2',
    tier: 'ruby',
    name: 'No Translation Needed',
    nameMn: 'Орчуулга хэрэггүй',
    condition: { type: 'words_mature', value: 250 },
  },
  {
    slug: 'emerald_no_translation_needed1',
    tier: 'emerald',
    name: 'Living Memory',
    nameMn: 'Амьд санах ой',
    condition: { type: 'words_mature', value: 500 },
  },
  {
    slug: 'starter_first_swipe',
    tier: 'starter',
    name: 'First Swipe',
    nameMn: 'Анхны карт',
    condition: { type: 'cards_swiped', value: 1 },
  },
  {
    slug: 'bronze_card_starter',
    tier: 'bronze',
    name: 'Card Starter',
    nameMn: 'Картын эхлэгч',
    condition: { type: 'cards_swiped', value: 50 },
  },
  {
    slug: 'silver_card_hunter',
    tier: 'silver',
    name: 'Card Hunter',
    nameMn: 'Картын анчин',
    condition: { type: 'cards_swiped', value: 200 },
  },
  {
    slug: 'gold_card_collector1',
    tier: 'gold',
    name: 'Card Collector',
    nameMn: 'Карт цуглуулагч',
    condition: { type: 'cards_swiped', value: 500 },
  },
  {
    slug: 'sapphire_card_collector',
    tier: 'sapphire',
    name: 'Card Master',
    nameMn: 'Картын мастер',
    condition: { type: 'cards_swiped', value: 1000 },
  },
  {
    slug: 'ruby_card_legend1',
    tier: 'ruby',
    name: 'Card Legend',
    nameMn: 'Картын домог',
    condition: { type: 'cards_swiped', value: 2500 },
  },
  {
    slug: 'starter_one_more_try',
    tier: 'starter',
    name: 'One More Try',
    nameMn: 'Дахиад нэг оролдлого',
    condition: { type: 'mistakes_fixed', value: 1 },
  },
  {
    slug: 'bronze_mistake_fixer',
    tier: 'bronze',
    name: 'Mistake Fixer',
    nameMn: 'Алдаа засагч',
    condition: { type: 'mistakes_fixed', value: 5 },
  },
  {
    slug: 'gold_mistake_slayer1',
    tier: 'gold',
    name: 'Mistake Slayer',
    nameMn: 'Алдааны дайсан',
    condition: { type: 'mistakes_fixed', value: 25 },
  },
  {
    slug: 'crystal_mistake_slayer_2',
    tier: 'crystal',
    name: 'Mistake Hunter',
    nameMn: 'Алдааны анчин',
    condition: { type: 'mistakes_fixed', value: 50 },
  },
  {
    slug: 'emerald_mistake_slayer3',
    tier: 'emerald',
    name: 'Mistake Destroyer',
    nameMn: 'Алдааг устгагч',
    condition: { type: 'mistakes_fixed', value: 150 },
  },
  {
    slug: 'starter_hello_buddy',
    tier: 'starter',
    name: 'Hello Buddy',
    nameMn: 'Сайн уу, найзаа',
    condition: { type: 'buddy_sessions', value: 1 },
  },
  {
    slug: 'bronze_buddy_bond',
    tier: 'bronze',
    name: 'Buddy Bond',
    nameMn: 'Найзын холбоо',
    condition: { type: 'buddy_sessions', value: 10 },
  },
  {
    slug: 'silver_buddy_bond2',
    tier: 'silver',
    name: 'Close Buddy',
    nameMn: 'Дотно найз',
    condition: { type: 'buddy_sessions', value: 25 },
  },
  {
    slug: 'gold_conversation_figther',
    tier: 'gold',
    name: 'Conversation Fighter',
    nameMn: 'Ярианы тэмцэгч',
    condition: { type: 'buddy_sessions', value: 50 },
  },
  {
    slug: 'crystal_buddy_loyalist',
    tier: 'crystal',
    name: 'Buddy Loyalist',
    nameMn: 'Үнэнч найз',
    condition: { type: 'buddy_sessions', value: 100 },
  },
  {
    slug: 'ruby_buddy_soul_mate',
    tier: 'ruby',
    name: 'Buddy Soul Mate',
    nameMn: 'Сэтгэлийн найз',
    condition: { type: 'buddy_sessions', value: 200 },
  },
  {
    slug: 'mythic_ai_circle_master',
    tier: 'mythic',
    name: 'AI Circle Master',
    nameMn: 'AI найзуудын тойрог',
    condition: { type: 'buddy_distinct', value: 5 },
  },
  {
    slug: 'starter_first_voice',
    tier: 'starter',
    name: 'First Voice',
    nameMn: 'Анхны дуу хоолой',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 1,
    },
  },
  {
    slug: 'bronze_brave_speaker',
    tier: 'bronze',
    name: 'Brave Speaker',
    nameMn: 'Зоригтой илтгэгч',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 5,
    },
  },
  {
    slug: 'silver_voice_builder',
    tier: 'silver',
    name: 'Voice Builder',
    nameMn: 'Дуу хоолой бүтээгч',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 20,
    },
  },
  {
    slug: 'sapphire_fluency_engine',
    tier: 'sapphire',
    name: 'Fluency Engine',
    nameMn: 'Чөлөөт ярианы хөдөлгүүр',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 50,
    },
  },
  {
    slug: 'crystal_fluency_engine2',
    tier: 'crystal',
    name: 'Fluency Pro',
    nameMn: 'Чөлөөт ярианы мэргэжилтэн',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 100,
    },
  },
  {
    slug: 'mythic_fluent_fox1',
    tier: 'mythic',
    name: 'Fluent Fox',
    nameMn: 'Чөлөөтэй ярьдаг үнэг',
    condition: {
      type: 'buddy_sessions',
      mode: BuddySessionMode.VOICE,
      value: 250,
    },
  },
  {
    slug: 'starter_first_spark',
    tier: 'starter',
    name: 'First Spark',
    nameMn: 'Анхны оч',
    condition: { type: 'sparks_total', value: 1 },
  },
  {
    slug: 'ruby_xp_beast',
    tier: 'ruby',
    name: 'XP Beast',
    nameMn: 'XP-ийн баатар',
    condition: { type: 'xp_total', value: 50000 },
  },
  {
    slug: 'celestial_the_crowned_fox',
    tier: 'celestial',
    name: 'The Crowned Fox',
    nameMn: 'Титэмтэй үнэг',
    condition: { type: 'trophy_count', value: 50 },
  },
];

/** Every live slug — used to ignore trophies retired by the cleanup. */
export const CATALOG_SLUGS = TROPHY_CATALOG.map((t) => t.slug);
