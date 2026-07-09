/**
 * AI-generated trophy catalog (100 badges on Cloudflare R2, by tier).
 * Regenerate from the R2 listing — do not hand-edit URLs.
 * `slug` = stable id (also stored in User.trophies when earned).
 */
export type TrophyTier =
  | 'starter' | 'bronze' | 'silver' | 'gold' | 'sapphire'
  | 'crystal' | 'ruby' | 'emerald' | 'mythic' | 'celestial';

export interface Trophy {
  slug: string;
  tier: TrophyTier;
  name: string;
  image: string;
}

/** Tier display order (low → high). */
export const TROPHY_TIERS: TrophyTier[] = ["starter","bronze","silver","gold","sapphire","crystal","ruby","emerald","mythic","celestial"];

export const TROPHY_CATALOG: Trophy[] = [
  {
    "slug": "starter_comeback_paw",
    "tier": "starter",
    "name": "Comeback Paw",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter-badge_comeback_paw.png"
  },
  {
    "slug": "starter_first_quiz",
    "tier": "starter",
    "name": "First Quiz",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_first_quiz.png"
  },
  {
    "slug": "starter_first_spark",
    "tier": "starter",
    "name": "First Spark",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter-badge_first_spark.png"
  },
  {
    "slug": "starter_first_swipe",
    "tier": "starter",
    "name": "First Swipe",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_first_swipe.png"
  },
  {
    "slug": "starter_first_voice",
    "tier": "starter",
    "name": "First Voice",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_first_voice.png"
  },
  {
    "slug": "starter_first_word",
    "tier": "starter",
    "name": "First Word",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_first_word.png"
  },
  {
    "slug": "starter_grammer_badge",
    "tier": "starter",
    "name": "Grammer Badge",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_grammer_badge.png"
  },
  {
    "slug": "starter_hello_buddy",
    "tier": "starter",
    "name": "Hello Buddy",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_hello_buddy.png"
  },
  {
    "slug": "starter_mini_listener",
    "tier": "starter",
    "name": "Mini Listener",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_mini_listener.png"
  },
  {
    "slug": "starter_one_more_try",
    "tier": "starter",
    "name": "One More Try",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_one_more_try.png"
  },
  {
    "slug": "bronze_brave_speaker",
    "tier": "bronze",
    "name": "Brave Speaker",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_brave_speaker.png"
  },
  {
    "slug": "bronze_buddy_bond",
    "tier": "bronze",
    "name": "Buddy Bond",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_buddy_bond.png"
  },
  {
    "slug": "bronze_card_starter",
    "tier": "bronze",
    "name": "Card Starter",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_card_starter.png"
  },
  {
    "slug": "bronze_image_guesser",
    "tier": "bronze",
    "name": "Image Guesser",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_image_guesser%20(1).png"
  },
  {
    "slug": "bronze_mistake_fixer",
    "tier": "bronze",
    "name": "Mistake Fixer",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_mistake-fixer.png"
  },
  {
    "slug": "bronze_pronounciation_rookie",
    "tier": "bronze",
    "name": "Pronounciation Rookie",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_pronounciation_rookie.png"
  },
  {
    "slug": "bronze_quiz_rookie",
    "tier": "bronze",
    "name": "Quiz Rookie",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_quiz%E2%80%93rookie.png"
  },
  {
    "slug": "bronze_sentence_maker",
    "tier": "bronze",
    "name": "Sentence Maker",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_sentence_maker.png"
  },
  {
    "slug": "bronze_weekly_flame",
    "tier": "bronze",
    "name": "Weekly Flame",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_weekly_flame.png"
  },
  {
    "slug": "bronze_word_paw",
    "tier": "bronze",
    "name": "Word Paw",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_word_paw.png"
  },
  {
    "slug": "silver_buddy_bond2",
    "tier": "silver",
    "name": "Buddy Bond2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_buddy_bond2.png"
  },
  {
    "slug": "silver_card_hunter",
    "tier": "silver",
    "name": "Card Hunter",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20card_hunter.png"
  },
  {
    "slug": "silver_discipline_paw",
    "tier": "silver",
    "name": "Discipline Paw",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20discipline_paw.png"
  },
  {
    "slug": "silver_emotion_speaker",
    "tier": "silver",
    "name": "Emotion Speaker",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20emotion-speaker.png"
  },
  {
    "slug": "silver_grammar_builder1",
    "tier": "silver",
    "name": "Grammar Builder1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20grammar_builder1.png"
  },
  {
    "slug": "silver_listening_builder1",
    "tier": "silver",
    "name": "Listening Builder1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20listening_builder1.png"
  },
  {
    "slug": "silver_perfect_five",
    "tier": "silver",
    "name": "Perfect Five",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20perfect_five.png"
  },
  {
    "slug": "silver_quiz_figther",
    "tier": "silver",
    "name": "Quiz Figther",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20quiz_figther.png"
  },
  {
    "slug": "silver_voice_builder",
    "tier": "silver",
    "name": "Voice Builder",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20voice_builder.png"
  },
  {
    "slug": "silver_word_hunter",
    "tier": "silver",
    "name": "Word Hunter",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_word_hunter%20(1).png"
  },
  {
    "slug": "gold_a1_finisher",
    "tier": "gold",
    "name": "A1 Finisher",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_a1_finisher.png"
  },
  {
    "slug": "gold_card_collector1",
    "tier": "gold",
    "name": "Card Collector1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20card_collector1%20(1).png"
  },
  {
    "slug": "gold_conversation_figther",
    "tier": "gold",
    "name": "Conversation Figther",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20conversation_figther.png"
  },
  {
    "slug": "gold_grammar_builder2",
    "tier": "gold",
    "name": "Grammar Builder2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_grammar%20builder2.png"
  },
  {
    "slug": "gold_listening_builder2",
    "tier": "gold",
    "name": "Listening Builder2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20listening_builder2%20(1).png"
  },
  {
    "slug": "gold_mistake_slayer1",
    "tier": "gold",
    "name": "Mistake Slayer1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20mistake_slayer1.png"
  },
  {
    "slug": "gold_monthly_grinder",
    "tier": "gold",
    "name": "Monthly Grinder",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20monthly_grinder.png"
  },
  {
    "slug": "gold_perfect_ten",
    "tier": "gold",
    "name": "Perfect Ten",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_perfect_ten.png"
  },
  {
    "slug": "gold_quiz_veteran",
    "tier": "gold",
    "name": "Quiz Veteran",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20quiz_veteran.png"
  },
  {
    "slug": "gold_word_collector",
    "tier": "gold",
    "name": "Word Collector",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20word_collector.png"
  },
  {
    "slug": "sapphire_a1_grammar_master",
    "tier": "sapphire",
    "name": "A1 Grammar Master",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_a1-grammar_master.png"
  },
  {
    "slug": "sapphire_a2_finisher",
    "tier": "sapphire",
    "name": "A2 Finisher",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_a2-finisher.png"
  },
  {
    "slug": "sapphire_a2_grammar_master",
    "tier": "sapphire",
    "name": "A2 Grammar Master",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_a2_grammar-master.png"
  },
  {
    "slug": "sapphire_card_collector",
    "tier": "sapphire",
    "name": "Card Collector",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_card_collector.png"
  },
  {
    "slug": "sapphire_fluency_engine",
    "tier": "sapphire",
    "name": "Fluency Engine",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_fluency-engine.png"
  },
  {
    "slug": "sapphire_iron_habit",
    "tier": "sapphire",
    "name": "Iron Habit",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_iron_habit.png"
  },
  {
    "slug": "sapphire_listening_master",
    "tier": "sapphire",
    "name": "Listening Master",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_listening_master.png"
  },
  {
    "slug": "sapphire_perfect_twenty",
    "tier": "sapphire",
    "name": "Perfect Twenty",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_perfect_twenty.png"
  },
  {
    "slug": "sapphire_quiz_architect",
    "tier": "sapphire",
    "name": "Quiz Architect",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_quiz_architect.png"
  },
  {
    "slug": "sapphire_quiz_champion",
    "tier": "sapphire",
    "name": "Quiz Champion",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_quiz_champion.png"
  },
  {
    "slug": "crystal_b1_finisher",
    "tier": "crystal",
    "name": "B1 Finisher",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20b1_finisher.png"
  },
  {
    "slug": "crystal_buddy_loyalist",
    "tier": "crystal",
    "name": "Buddy Loyalist",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20buddy_loyalist.png"
  },
  {
    "slug": "crystal_fluency_engine2",
    "tier": "crystal",
    "name": "Fluency Engine2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20fluency_engine2.png"
  },
  {
    "slug": "crystal_grammar_master3",
    "tier": "crystal",
    "name": "Grammar Master3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20grammar_master3.png"
  },
  {
    "slug": "crystal_iron_habit2",
    "tier": "crystal",
    "name": "Iron Habit2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20iron_habit2.png"
  },
  {
    "slug": "crystal_listening_master2",
    "tier": "crystal",
    "name": "Listening Master2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20listening_master2.png"
  },
  {
    "slug": "crystal_mistake_slayer_2",
    "tier": "crystal",
    "name": "Mistake Slayer 2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20mistake_slayer_2.png"
  },
  {
    "slug": "crystal_quiz_champion2",
    "tier": "crystal",
    "name": "Quiz Champion2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20quiz_champion2.png"
  },
  {
    "slug": "crystal_rare_card_hunter",
    "tier": "crystal",
    "name": "Rare Card Hunter",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20rare_card_hunter.png"
  },
  {
    "slug": "crystal_word_master1",
    "tier": "crystal",
    "name": "Word Master1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20word_master1.png"
  },
  {
    "slug": "ruby_buddy_soul_mate",
    "tier": "ruby",
    "name": "Buddy Soul Mate",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20buddy_soul_mate.png"
  },
  {
    "slug": "ruby_card_legend1",
    "tier": "ruby",
    "name": "Card Legend1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_card_legend1.png"
  },
  {
    "slug": "ruby_fluency_trial1",
    "tier": "ruby",
    "name": "Fluency Trial1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20fluency_trial1.png"
  },
  {
    "slug": "ruby_grammar_complationist",
    "tier": "ruby",
    "name": "Grammar Complationist",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_grammar_complationist.png"
  },
  {
    "slug": "ruby_half_year_spark",
    "tier": "ruby",
    "name": "Half Year Spark",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_half_year_spark.png"
  },
  {
    "slug": "ruby_lexicon_beast1",
    "tier": "ruby",
    "name": "Lexicon Beast1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_lexicon_beast1.png"
  },
  {
    "slug": "ruby_listening_master_4",
    "tier": "ruby",
    "name": "Listening Master 4",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20listening_master_4.png"
  },
  {
    "slug": "ruby_no_translation_needed_2",
    "tier": "ruby",
    "name": "No Translation Needed 2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_no_translation_needed_2.png"
  },
  {
    "slug": "ruby_quiz_legend1",
    "tier": "ruby",
    "name": "Quiz Legend1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_quiz_legend1.png"
  },
  {
    "slug": "ruby_xp_beast",
    "tier": "ruby",
    "name": "Xp Beast",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20XP_beast.png"
  },
  {
    "slug": "emerald_b2_finisher",
    "tier": "emerald",
    "name": "B2 Finisher",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_b2_finisher.png"
  },
  {
    "slug": "emerald_epic_card_hunter",
    "tier": "emerald",
    "name": "Epic Card Hunter",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_epic_card_hunter.png"
  },
  {
    "slug": "emerald_grammar_master4",
    "tier": "emerald",
    "name": "Grammar Master4",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_grammar-master4.png"
  },
  {
    "slug": "emerald_hundred_day_fox",
    "tier": "emerald",
    "name": "Hundred Day Fox",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_hundred_day_fox.png"
  },
  {
    "slug": "emerald_listening_master3",
    "tier": "emerald",
    "name": "Listening Master3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_listening-master3.png"
  },
  {
    "slug": "emerald_mistake_slayer3",
    "tier": "emerald",
    "name": "Mistake Slayer3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_mistake_slayer3.png"
  },
  {
    "slug": "emerald_no_translation_needed1",
    "tier": "emerald",
    "name": "No Translation Needed1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_no_translation-needed1.png"
  },
  {
    "slug": "emerald_perfect_fifty",
    "tier": "emerald",
    "name": "Perfect Fifty",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_perfect-fifty.png"
  },
  {
    "slug": "emerald_quiz_champion3",
    "tier": "emerald",
    "name": "Quiz Champion3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_quiz_champion3.png"
  },
  {
    "slug": "emerald_word_master3",
    "tier": "emerald",
    "name": "Word Master3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_word_master3.png"
  },
  {
    "slug": "mythic_ai_circle_master",
    "tier": "mythic",
    "name": "Ai Circle Master",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_%20ai_circle_master.png"
  },
  {
    "slug": "mythic_card_legend2",
    "tier": "mythic",
    "name": "Card Legend2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_card_legend2.png"
  },
  {
    "slug": "mythic_english_xp_champion",
    "tier": "mythic",
    "name": "English Xp Champion",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_english-xp_champion.png"
  },
  {
    "slug": "mythic_fluency_trial2",
    "tier": "mythic",
    "name": "Fluency Trial2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_fluency_trial2.png"
  },
  {
    "slug": "mythic_fluent_fox1",
    "tier": "mythic",
    "name": "Fluent Fox1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_fluent_fox1.png"
  },
  {
    "slug": "mythic_grand_collector1",
    "tier": "mythic",
    "name": "Grand Collector1",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_grand_collector1.png"
  },
  {
    "slug": "mythic_lexicon_beast2",
    "tier": "mythic",
    "name": "Lexicon Beast2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_lexicon_beast2.png"
  },
  {
    "slug": "mythic_living_dictionary",
    "tier": "mythic",
    "name": "Living Dictionary",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_living_dictionary.png"
  },
  {
    "slug": "mythic_mistake_slayer4",
    "tier": "mythic",
    "name": "Mistake Slayer4",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_mistake_slayer4.png"
  },
  {
    "slug": "mythic_one_year_spark",
    "tier": "mythic",
    "name": "One Year Spark",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_one_year_spark.png"
  },
  {
    "slug": "mythic_quiz_legend2",
    "tier": "mythic",
    "name": "Quiz Legend2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_quiz_legend2.png"
  },
  {
    "slug": "celestial_eternal_habit",
    "tier": "celestial",
    "name": "Eternal Habit",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_eternal_habit.png"
  },
  {
    "slug": "celestial_fluency_trial3",
    "tier": "celestial",
    "name": "Fluency Trial3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_fluency_trial3.png"
  },
  {
    "slug": "celestial_fluent_fox2",
    "tier": "celestial",
    "name": "Fluent Fox2",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_fluent_fox2.png"
  },
  {
    "slug": "celestial_grand_collector3",
    "tier": "celestial",
    "name": "Grand Collector3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_grand-collector3.png"
  },
  {
    "slug": "celestial_legend_card3",
    "tier": "celestial",
    "name": "Legend Card3",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_legend_card3.png"
  },
  {
    "slug": "celestial_mistake_destroyer",
    "tier": "celestial",
    "name": "Mistake Destroyer",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_mistake_destroyer.png"
  },
  {
    "slug": "celestial_quiz_immortal",
    "tier": "celestial",
    "name": "Quiz Immortal",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_quiz_immortal.png"
  },
  {
    "slug": "celestial_the_crowned_fox",
    "tier": "celestial",
    "name": "The Crowned Fox",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_the_crowned_fox.png"
  },
  {
    "slug": "celestial_the_eternal_spark",
    "tier": "celestial",
    "name": "The Eternal Spark",
    "image": "https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev/englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_the_eternal_spark.png"
  }
];
