/**
 * AI-generated trophy catalog (100 badges on Cloudflare R2, by tier).
 * Image URLs are NOT stored here: both sizes live at
 * trophies/{full,thumb}/<slug>.webp, so AchievementsService derives them
 * from the slug. Only the slug must stay stable.
 * `slug` = stable id (also stored in User.trophies when earned).
 */
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
  },
  {
    slug: 'starter_first_quiz',
    tier: 'starter',
    name: 'First Quiz',
  },
  {
    slug: 'starter_first_spark',
    tier: 'starter',
    name: 'First Spark',
  },
  {
    slug: 'starter_first_swipe',
    tier: 'starter',
    name: 'First Swipe',
  },
  {
    slug: 'starter_first_voice',
    tier: 'starter',
    name: 'First Voice',
  },
  {
    slug: 'starter_first_word',
    tier: 'starter',
    name: 'First Word',
  },
  {
    slug: 'starter_grammer_badge',
    tier: 'starter',
    name: 'Grammer Badge',
  },
  {
    slug: 'starter_hello_buddy',
    tier: 'starter',
    name: 'Hello Buddy',
  },
  {
    slug: 'starter_mini_listener',
    tier: 'starter',
    name: 'Mini Listener',
  },
  {
    slug: 'starter_one_more_try',
    tier: 'starter',
    name: 'One More Try',
  },
  {
    slug: 'bronze_brave_speaker',
    tier: 'bronze',
    name: 'Brave Speaker',
  },
  {
    slug: 'bronze_buddy_bond',
    tier: 'bronze',
    name: 'Buddy Bond',
  },
  {
    slug: 'bronze_card_starter',
    tier: 'bronze',
    name: 'Card Starter',
  },
  {
    slug: 'bronze_image_guesser',
    tier: 'bronze',
    name: 'Image Guesser',
  },
  {
    slug: 'bronze_mistake_fixer',
    tier: 'bronze',
    name: 'Mistake Fixer',
  },
  {
    slug: 'bronze_pronounciation_rookie',
    tier: 'bronze',
    name: 'Pronounciation Rookie',
  },
  {
    slug: 'bronze_quiz_rookie',
    tier: 'bronze',
    name: 'Quiz Rookie',
  },
  {
    slug: 'bronze_sentence_maker',
    tier: 'bronze',
    name: 'Sentence Maker',
  },
  {
    slug: 'bronze_weekly_flame',
    tier: 'bronze',
    name: 'Weekly Flame',
  },
  {
    slug: 'bronze_word_paw',
    tier: 'bronze',
    name: 'Word Paw',
  },
  {
    slug: 'silver_buddy_bond2',
    tier: 'silver',
    name: 'Buddy Bond2',
  },
  {
    slug: 'silver_card_hunter',
    tier: 'silver',
    name: 'Card Hunter',
  },
  {
    slug: 'silver_discipline_paw',
    tier: 'silver',
    name: 'Discipline Paw',
  },
  {
    slug: 'silver_emotion_speaker',
    tier: 'silver',
    name: 'Emotion Speaker',
  },
  {
    slug: 'silver_grammar_builder1',
    tier: 'silver',
    name: 'Grammar Builder1',
  },
  {
    slug: 'silver_listening_builder1',
    tier: 'silver',
    name: 'Listening Builder1',
  },
  {
    slug: 'silver_perfect_five',
    tier: 'silver',
    name: 'Perfect Five',
  },
  {
    slug: 'silver_quiz_figther',
    tier: 'silver',
    name: 'Quiz Figther',
  },
  {
    slug: 'silver_voice_builder',
    tier: 'silver',
    name: 'Voice Builder',
  },
  {
    slug: 'silver_word_hunter',
    tier: 'silver',
    name: 'Word Hunter',
  },
  {
    slug: 'gold_a1_finisher',
    tier: 'gold',
    name: 'A1 Finisher',
  },
  {
    slug: 'gold_card_collector1',
    tier: 'gold',
    name: 'Card Collector1',
  },
  {
    slug: 'gold_conversation_figther',
    tier: 'gold',
    name: 'Conversation Figther',
  },
  {
    slug: 'gold_grammar_builder2',
    tier: 'gold',
    name: 'Grammar Builder2',
  },
  {
    slug: 'gold_listening_builder2',
    tier: 'gold',
    name: 'Listening Builder2',
  },
  {
    slug: 'gold_mistake_slayer1',
    tier: 'gold',
    name: 'Mistake Slayer1',
  },
  {
    slug: 'gold_monthly_grinder',
    tier: 'gold',
    name: 'Monthly Grinder',
  },
  {
    slug: 'gold_perfect_ten',
    tier: 'gold',
    name: 'Perfect Ten',
  },
  {
    slug: 'gold_quiz_veteran',
    tier: 'gold',
    name: 'Quiz Veteran',
  },
  {
    slug: 'gold_word_collector',
    tier: 'gold',
    name: 'Word Collector',
  },
  {
    slug: 'sapphire_a1_grammar_master',
    tier: 'sapphire',
    name: 'A1 Grammar Master',
  },
  {
    slug: 'sapphire_a2_finisher',
    tier: 'sapphire',
    name: 'A2 Finisher',
  },
  {
    slug: 'sapphire_a2_grammar_master',
    tier: 'sapphire',
    name: 'A2 Grammar Master',
  },
  {
    slug: 'sapphire_card_collector',
    tier: 'sapphire',
    name: 'Card Collector',
  },
  {
    slug: 'sapphire_fluency_engine',
    tier: 'sapphire',
    name: 'Fluency Engine',
  },
  {
    slug: 'sapphire_iron_habit',
    tier: 'sapphire',
    name: 'Iron Habit',
  },
  {
    slug: 'sapphire_listening_master',
    tier: 'sapphire',
    name: 'Listening Master',
  },
  {
    slug: 'sapphire_perfect_twenty',
    tier: 'sapphire',
    name: 'Perfect Twenty',
  },
  {
    slug: 'sapphire_quiz_architect',
    tier: 'sapphire',
    name: 'Quiz Architect',
  },
  {
    slug: 'sapphire_quiz_champion',
    tier: 'sapphire',
    name: 'Quiz Champion',
  },
  {
    slug: 'crystal_b1_finisher',
    tier: 'crystal',
    name: 'B1 Finisher',
  },
  {
    slug: 'crystal_buddy_loyalist',
    tier: 'crystal',
    name: 'Buddy Loyalist',
  },
  {
    slug: 'crystal_fluency_engine2',
    tier: 'crystal',
    name: 'Fluency Engine2',
  },
  {
    slug: 'crystal_grammar_master3',
    tier: 'crystal',
    name: 'Grammar Master3',
  },
  {
    slug: 'crystal_iron_habit2',
    tier: 'crystal',
    name: 'Iron Habit2',
  },
  {
    slug: 'crystal_listening_master2',
    tier: 'crystal',
    name: 'Listening Master2',
  },
  {
    slug: 'crystal_mistake_slayer_2',
    tier: 'crystal',
    name: 'Mistake Slayer 2',
  },
  {
    slug: 'crystal_quiz_champion2',
    tier: 'crystal',
    name: 'Quiz Champion2',
  },
  {
    slug: 'crystal_rare_card_hunter',
    tier: 'crystal',
    name: 'Rare Card Hunter',
  },
  {
    slug: 'crystal_word_master1',
    tier: 'crystal',
    name: 'Word Master1',
  },
  {
    slug: 'ruby_buddy_soul_mate',
    tier: 'ruby',
    name: 'Buddy Soul Mate',
  },
  {
    slug: 'ruby_card_legend1',
    tier: 'ruby',
    name: 'Card Legend1',
  },
  {
    slug: 'ruby_fluency_trial1',
    tier: 'ruby',
    name: 'Fluency Trial1',
  },
  {
    slug: 'ruby_grammar_complationist',
    tier: 'ruby',
    name: 'Grammar Complationist',
  },
  {
    slug: 'ruby_half_year_spark',
    tier: 'ruby',
    name: 'Half Year Spark',
  },
  {
    slug: 'ruby_lexicon_beast1',
    tier: 'ruby',
    name: 'Lexicon Beast1',
  },
  {
    slug: 'ruby_listening_master_4',
    tier: 'ruby',
    name: 'Listening Master 4',
  },
  {
    slug: 'ruby_no_translation_needed_2',
    tier: 'ruby',
    name: 'No Translation Needed 2',
  },
  {
    slug: 'ruby_quiz_legend1',
    tier: 'ruby',
    name: 'Quiz Legend1',
  },
  {
    slug: 'ruby_xp_beast',
    tier: 'ruby',
    name: 'Xp Beast',
  },
  {
    slug: 'emerald_b2_finisher',
    tier: 'emerald',
    name: 'B2 Finisher',
  },
  {
    slug: 'emerald_epic_card_hunter',
    tier: 'emerald',
    name: 'Epic Card Hunter',
  },
  {
    slug: 'emerald_grammar_master4',
    tier: 'emerald',
    name: 'Grammar Master4',
  },
  {
    slug: 'emerald_hundred_day_fox',
    tier: 'emerald',
    name: 'Hundred Day Fox',
  },
  {
    slug: 'emerald_listening_master3',
    tier: 'emerald',
    name: 'Listening Master3',
  },
  {
    slug: 'emerald_mistake_slayer3',
    tier: 'emerald',
    name: 'Mistake Slayer3',
  },
  {
    slug: 'emerald_no_translation_needed1',
    tier: 'emerald',
    name: 'No Translation Needed1',
  },
  {
    slug: 'emerald_perfect_fifty',
    tier: 'emerald',
    name: 'Perfect Fifty',
  },
  {
    slug: 'emerald_quiz_champion3',
    tier: 'emerald',
    name: 'Quiz Champion3',
  },
  {
    slug: 'emerald_word_master3',
    tier: 'emerald',
    name: 'Word Master3',
  },
  {
    slug: 'mythic_ai_circle_master',
    tier: 'mythic',
    name: 'Ai Circle Master',
  },
  {
    slug: 'mythic_card_legend2',
    tier: 'mythic',
    name: 'Card Legend2',
  },
  {
    slug: 'mythic_english_xp_champion',
    tier: 'mythic',
    name: 'English Xp Champion',
  },
  {
    slug: 'mythic_fluency_trial2',
    tier: 'mythic',
    name: 'Fluency Trial2',
  },
  {
    slug: 'mythic_fluent_fox1',
    tier: 'mythic',
    name: 'Fluent Fox1',
  },
  {
    slug: 'mythic_grand_collector1',
    tier: 'mythic',
    name: 'Grand Collector1',
  },
  {
    slug: 'mythic_lexicon_beast2',
    tier: 'mythic',
    name: 'Lexicon Beast2',
  },
  {
    slug: 'mythic_living_dictionary',
    tier: 'mythic',
    name: 'Living Dictionary',
  },
  {
    slug: 'mythic_mistake_slayer4',
    tier: 'mythic',
    name: 'Mistake Slayer4',
  },
  {
    slug: 'mythic_one_year_spark',
    tier: 'mythic',
    name: 'One Year Spark',
  },
  {
    slug: 'mythic_quiz_legend2',
    tier: 'mythic',
    name: 'Quiz Legend2',
  },
  {
    slug: 'celestial_eternal_habit',
    tier: 'celestial',
    name: 'Eternal Habit',
  },
  {
    slug: 'celestial_fluency_trial3',
    tier: 'celestial',
    name: 'Fluency Trial3',
  },
  {
    slug: 'celestial_fluent_fox2',
    tier: 'celestial',
    name: 'Fluent Fox2',
  },
  {
    slug: 'celestial_grand_collector3',
    tier: 'celestial',
    name: 'Grand Collector3',
  },
  {
    slug: 'celestial_legend_card3',
    tier: 'celestial',
    name: 'Legend Card3',
  },
  {
    slug: 'celestial_mistake_destroyer',
    tier: 'celestial',
    name: 'Mistake Destroyer',
  },
  {
    slug: 'celestial_quiz_immortal',
    tier: 'celestial',
    name: 'Quiz Immortal',
  },
  {
    slug: 'celestial_the_crowned_fox',
    tier: 'celestial',
    name: 'The Crowned Fox',
  },
  {
    slug: 'celestial_the_eternal_spark',
    tier: 'celestial',
    name: 'The Eternal Spark',
  },
];
