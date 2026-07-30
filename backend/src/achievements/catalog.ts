/**
 * AI-generated trophy catalog (100 badges on Cloudflare R2, by tier).
 * Regenerate from the R2 listing — do not hand-edit paths.
 * Stores the R2 key only; AchievementsService prefixes R2_PUBLIC_BASE_URL.
 * `slug` = stable id (also stored in User.trophies when earned).
 */
export type TrophyTier =
  | 'starter' | 'bronze' | 'silver' | 'gold' | 'sapphire'
  | 'crystal' | 'ruby' | 'emerald' | 'mythic' | 'celestial';

export interface Trophy {
  slug: string;
  tier: TrophyTier;
  name: string;
  /** R2 key only. The full URL is built at serve time from
   *  R2_PUBLIC_BASE_URL so the CDN domain can change without a deploy. */
  imagePath: string;
}

/** Tier display order (low → high). */
export const TROPHY_TIERS: TrophyTier[] = ["starter","bronze","silver","gold","sapphire","crystal","ruby","emerald","mythic","celestial"];

export const TROPHY_CATALOG: Trophy[] = [
  {
    "slug": "starter_comeback_paw",
    "tier": "starter",
    "name": "Comeback Paw",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter-badge_comeback_paw.webp"
  },
  {
    "slug": "starter_first_quiz",
    "tier": "starter",
    "name": "First Quiz",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_first_quiz.webp"
  },
  {
    "slug": "starter_first_spark",
    "tier": "starter",
    "name": "First Spark",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter-badge_first_spark.webp"
  },
  {
    "slug": "starter_first_swipe",
    "tier": "starter",
    "name": "First Swipe",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_first_swipe.webp"
  },
  {
    "slug": "starter_first_voice",
    "tier": "starter",
    "name": "First Voice",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_first_voice.webp"
  },
  {
    "slug": "starter_first_word",
    "tier": "starter",
    "name": "First Word",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_first_word.webp"
  },
  {
    "slug": "starter_grammer_badge",
    "tier": "starter",
    "name": "Grammer Badge",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_grammer_badge.webp"
  },
  {
    "slug": "starter_hello_buddy",
    "tier": "starter",
    "name": "Hello Buddy",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_hello_buddy.webp"
  },
  {
    "slug": "starter_mini_listener",
    "tier": "starter",
    "name": "Mini Listener",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_mini_listener.webp"
  },
  {
    "slug": "starter_one_more_try",
    "tier": "starter",
    "name": "One More Try",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Starter_Badge/starter_badge_one_more_try.webp"
  },
  {
    "slug": "bronze_brave_speaker",
    "tier": "bronze",
    "name": "Brave Speaker",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_brave_speaker.webp"
  },
  {
    "slug": "bronze_buddy_bond",
    "tier": "bronze",
    "name": "Buddy Bond",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_buddy_bond.webp"
  },
  {
    "slug": "bronze_card_starter",
    "tier": "bronze",
    "name": "Card Starter",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_card_starter.webp"
  },
  {
    "slug": "bronze_image_guesser",
    "tier": "bronze",
    "name": "Image Guesser",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_image_guesser%20(1).webp"
  },
  {
    "slug": "bronze_mistake_fixer",
    "tier": "bronze",
    "name": "Mistake Fixer",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_mistake-fixer.webp"
  },
  {
    "slug": "bronze_pronounciation_rookie",
    "tier": "bronze",
    "name": "Pronounciation Rookie",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_pronounciation_rookie.webp"
  },
  {
    "slug": "bronze_quiz_rookie",
    "tier": "bronze",
    "name": "Quiz Rookie",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_quiz%E2%80%93rookie.webp"
  },
  {
    "slug": "bronze_sentence_maker",
    "tier": "bronze",
    "name": "Sentence Maker",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_sentence_maker.webp"
  },
  {
    "slug": "bronze_weekly_flame",
    "tier": "bronze",
    "name": "Weekly Flame",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_weekly_flame.webp"
  },
  {
    "slug": "bronze_word_paw",
    "tier": "bronze",
    "name": "Word Paw",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Bronze%20paw/bronze_paw_word_paw.webp"
  },
  {
    "slug": "silver_buddy_bond2",
    "tier": "silver",
    "name": "Buddy Bond2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_buddy_bond2.webp"
  },
  {
    "slug": "silver_card_hunter",
    "tier": "silver",
    "name": "Card Hunter",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20card_hunter.webp"
  },
  {
    "slug": "silver_discipline_paw",
    "tier": "silver",
    "name": "Discipline Paw",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20discipline_paw.webp"
  },
  {
    "slug": "silver_emotion_speaker",
    "tier": "silver",
    "name": "Emotion Speaker",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20emotion-speaker.webp"
  },
  {
    "slug": "silver_grammar_builder1",
    "tier": "silver",
    "name": "Grammar Builder1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20grammar_builder1.webp"
  },
  {
    "slug": "silver_listening_builder1",
    "tier": "silver",
    "name": "Listening Builder1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20listening_builder1.webp"
  },
  {
    "slug": "silver_perfect_five",
    "tier": "silver",
    "name": "Perfect Five",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20perfect_five.webp"
  },
  {
    "slug": "silver_quiz_figther",
    "tier": "silver",
    "name": "Quiz Figther",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20quiz_figther.webp"
  },
  {
    "slug": "silver_voice_builder",
    "tier": "silver",
    "name": "Voice Builder",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_%20voice_builder.webp"
  },
  {
    "slug": "silver_word_hunter",
    "tier": "silver",
    "name": "Word Hunter",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Silver_Paw/silver_paw_word_hunter%20(1).webp"
  },
  {
    "slug": "gold_a1_finisher",
    "tier": "gold",
    "name": "A1 Finisher",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_a1_finisher.webp"
  },
  {
    "slug": "gold_card_collector1",
    "tier": "gold",
    "name": "Card Collector1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20card_collector1%20(1).webp"
  },
  {
    "slug": "gold_conversation_figther",
    "tier": "gold",
    "name": "Conversation Figther",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20conversation_figther.webp"
  },
  {
    "slug": "gold_grammar_builder2",
    "tier": "gold",
    "name": "Grammar Builder2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_grammar%20builder2.webp"
  },
  {
    "slug": "gold_listening_builder2",
    "tier": "gold",
    "name": "Listening Builder2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20listening_builder2%20(1).webp"
  },
  {
    "slug": "gold_mistake_slayer1",
    "tier": "gold",
    "name": "Mistake Slayer1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20mistake_slayer1.webp"
  },
  {
    "slug": "gold_monthly_grinder",
    "tier": "gold",
    "name": "Monthly Grinder",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20monthly_grinder.webp"
  },
  {
    "slug": "gold_perfect_ten",
    "tier": "gold",
    "name": "Perfect Ten",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_perfect_ten.webp"
  },
  {
    "slug": "gold_quiz_veteran",
    "tier": "gold",
    "name": "Quiz Veteran",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20quiz_veteran.webp"
  },
  {
    "slug": "gold_word_collector",
    "tier": "gold",
    "name": "Word Collector",
    "imagePath": "englishxp/media/trophy/Spark_XP%20golden_Paw/golden_paw_%20word_collector.webp"
  },
  {
    "slug": "sapphire_a1_grammar_master",
    "tier": "sapphire",
    "name": "A1 Grammar Master",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_a1-grammar_master.webp"
  },
  {
    "slug": "sapphire_a2_finisher",
    "tier": "sapphire",
    "name": "A2 Finisher",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_a2-finisher.webp"
  },
  {
    "slug": "sapphire_a2_grammar_master",
    "tier": "sapphire",
    "name": "A2 Grammar Master",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_a2_grammar-master.webp"
  },
  {
    "slug": "sapphire_card_collector",
    "tier": "sapphire",
    "name": "Card Collector",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_card_collector.webp"
  },
  {
    "slug": "sapphire_fluency_engine",
    "tier": "sapphire",
    "name": "Fluency Engine",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_fluency-engine.webp"
  },
  {
    "slug": "sapphire_iron_habit",
    "tier": "sapphire",
    "name": "Iron Habit",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_iron_habit.webp"
  },
  {
    "slug": "sapphire_listening_master",
    "tier": "sapphire",
    "name": "Listening Master",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_listening_master.webp"
  },
  {
    "slug": "sapphire_perfect_twenty",
    "tier": "sapphire",
    "name": "Perfect Twenty",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_perfect_twenty.webp"
  },
  {
    "slug": "sapphire_quiz_architect",
    "tier": "sapphire",
    "name": "Quiz Architect",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_quiz_architect.webp"
  },
  {
    "slug": "sapphire_quiz_champion",
    "tier": "sapphire",
    "name": "Quiz Champion",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Sapphire_Paw/Sapphire_paw_quiz_champion.webp"
  },
  {
    "slug": "crystal_b1_finisher",
    "tier": "crystal",
    "name": "B1 Finisher",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20b1_finisher.webp"
  },
  {
    "slug": "crystal_buddy_loyalist",
    "tier": "crystal",
    "name": "Buddy Loyalist",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20buddy_loyalist.webp"
  },
  {
    "slug": "crystal_fluency_engine2",
    "tier": "crystal",
    "name": "Fluency Engine2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20fluency_engine2.webp"
  },
  {
    "slug": "crystal_grammar_master3",
    "tier": "crystal",
    "name": "Grammar Master3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20grammar_master3.webp"
  },
  {
    "slug": "crystal_iron_habit2",
    "tier": "crystal",
    "name": "Iron Habit2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20iron_habit2.webp"
  },
  {
    "slug": "crystal_listening_master2",
    "tier": "crystal",
    "name": "Listening Master2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20listening_master2.webp"
  },
  {
    "slug": "crystal_mistake_slayer_2",
    "tier": "crystal",
    "name": "Mistake Slayer 2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20mistake_slayer_2.webp"
  },
  {
    "slug": "crystal_quiz_champion2",
    "tier": "crystal",
    "name": "Quiz Champion2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20quiz_champion2.webp"
  },
  {
    "slug": "crystal_rare_card_hunter",
    "tier": "crystal",
    "name": "Rare Card Hunter",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20rare_card_hunter.webp"
  },
  {
    "slug": "crystal_word_master1",
    "tier": "crystal",
    "name": "Word Master1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Crystal_Paw/crystal_paw_%20word_master1.webp"
  },
  {
    "slug": "ruby_buddy_soul_mate",
    "tier": "ruby",
    "name": "Buddy Soul Mate",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20buddy_soul_mate.webp"
  },
  {
    "slug": "ruby_card_legend1",
    "tier": "ruby",
    "name": "Card Legend1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_card_legend1.webp"
  },
  {
    "slug": "ruby_fluency_trial1",
    "tier": "ruby",
    "name": "Fluency Trial1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20fluency_trial1.webp"
  },
  {
    "slug": "ruby_grammar_complationist",
    "tier": "ruby",
    "name": "Grammar Complationist",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_grammar_complationist.webp"
  },
  {
    "slug": "ruby_half_year_spark",
    "tier": "ruby",
    "name": "Half Year Spark",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_half_year_spark.webp"
  },
  {
    "slug": "ruby_lexicon_beast1",
    "tier": "ruby",
    "name": "Lexicon Beast1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_lexicon_beast1.webp"
  },
  {
    "slug": "ruby_listening_master_4",
    "tier": "ruby",
    "name": "Listening Master 4",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20listening_master_4.webp"
  },
  {
    "slug": "ruby_no_translation_needed_2",
    "tier": "ruby",
    "name": "No Translation Needed 2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_no_translation_needed_2.webp"
  },
  {
    "slug": "ruby_quiz_legend1",
    "tier": "ruby",
    "name": "Quiz Legend1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_quiz_legend1.webp"
  },
  {
    "slug": "ruby_xp_beast",
    "tier": "ruby",
    "name": "Xp Beast",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Ruby_Trophy/Ruby_trophy_%20XP_beast.webp"
  },
  {
    "slug": "emerald_b2_finisher",
    "tier": "emerald",
    "name": "B2 Finisher",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_b2_finisher.webp"
  },
  {
    "slug": "emerald_epic_card_hunter",
    "tier": "emerald",
    "name": "Epic Card Hunter",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_epic_card_hunter.webp"
  },
  {
    "slug": "emerald_grammar_master4",
    "tier": "emerald",
    "name": "Grammar Master4",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_grammar-master4.webp"
  },
  {
    "slug": "emerald_hundred_day_fox",
    "tier": "emerald",
    "name": "Hundred Day Fox",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_hundred_day_fox.webp"
  },
  {
    "slug": "emerald_listening_master3",
    "tier": "emerald",
    "name": "Listening Master3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_listening-master3.webp"
  },
  {
    "slug": "emerald_mistake_slayer3",
    "tier": "emerald",
    "name": "Mistake Slayer3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_mistake_slayer3.webp"
  },
  {
    "slug": "emerald_no_translation_needed1",
    "tier": "emerald",
    "name": "No Translation Needed1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_no_translation-needed1.webp"
  },
  {
    "slug": "emerald_perfect_fifty",
    "tier": "emerald",
    "name": "Perfect Fifty",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_perfect-fifty.webp"
  },
  {
    "slug": "emerald_quiz_champion3",
    "tier": "emerald",
    "name": "Quiz Champion3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_quiz_champion3.webp"
  },
  {
    "slug": "emerald_word_master3",
    "tier": "emerald",
    "name": "Word Master3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Emerald_Trophy/emerald_trophy_word_master3.webp"
  },
  {
    "slug": "mythic_ai_circle_master",
    "tier": "mythic",
    "name": "Ai Circle Master",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_%20ai_circle_master.webp"
  },
  {
    "slug": "mythic_card_legend2",
    "tier": "mythic",
    "name": "Card Legend2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_card_legend2.webp"
  },
  {
    "slug": "mythic_english_xp_champion",
    "tier": "mythic",
    "name": "English Xp Champion",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_english-xp_champion.webp"
  },
  {
    "slug": "mythic_fluency_trial2",
    "tier": "mythic",
    "name": "Fluency Trial2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_fluency_trial2.webp"
  },
  {
    "slug": "mythic_fluent_fox1",
    "tier": "mythic",
    "name": "Fluent Fox1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_fluent_fox1.webp"
  },
  {
    "slug": "mythic_grand_collector1",
    "tier": "mythic",
    "name": "Grand Collector1",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_grand_collector1.webp"
  },
  {
    "slug": "mythic_lexicon_beast2",
    "tier": "mythic",
    "name": "Lexicon Beast2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_lexicon_beast2.webp"
  },
  {
    "slug": "mythic_living_dictionary",
    "tier": "mythic",
    "name": "Living Dictionary",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_living_dictionary.webp"
  },
  {
    "slug": "mythic_mistake_slayer4",
    "tier": "mythic",
    "name": "Mistake Slayer4",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_mistake_slayer4.webp"
  },
  {
    "slug": "mythic_one_year_spark",
    "tier": "mythic",
    "name": "One Year Spark",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_one_year_spark.webp"
  },
  {
    "slug": "mythic_quiz_legend2",
    "tier": "mythic",
    "name": "Quiz Legend2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Mythic_Slayer/mythic_trophy_quiz_legend2.webp"
  },
  {
    "slug": "celestial_eternal_habit",
    "tier": "celestial",
    "name": "Eternal Habit",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_eternal_habit.webp"
  },
  {
    "slug": "celestial_fluency_trial3",
    "tier": "celestial",
    "name": "Fluency Trial3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_fluency_trial3.webp"
  },
  {
    "slug": "celestial_fluent_fox2",
    "tier": "celestial",
    "name": "Fluent Fox2",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_fluent_fox2.webp"
  },
  {
    "slug": "celestial_grand_collector3",
    "tier": "celestial",
    "name": "Grand Collector3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_grand-collector3.webp"
  },
  {
    "slug": "celestial_legend_card3",
    "tier": "celestial",
    "name": "Legend Card3",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_legend_card3.webp"
  },
  {
    "slug": "celestial_mistake_destroyer",
    "tier": "celestial",
    "name": "Mistake Destroyer",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_mistake_destroyer.webp"
  },
  {
    "slug": "celestial_quiz_immortal",
    "tier": "celestial",
    "name": "Quiz Immortal",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_quiz_immortal.webp"
  },
  {
    "slug": "celestial_the_crowned_fox",
    "tier": "celestial",
    "name": "The Crowned Fox",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_the_crowned_fox.webp"
  },
  {
    "slug": "celestial_the_eternal_spark",
    "tier": "celestial",
    "name": "The Eternal Spark",
    "imagePath": "englishxp/media/trophy/Spark_XP%20Celestial%20trophy/celestial_%20trophy_the_eternal_spark.webp"
  }
];
