# Trophy систем — цэгцлэлт (2026-09-28)

**100 → 68 трофей.** Дүрэм: нэг статистикт нэг шат, шат бүр бодит үсрэлт, бүх
нөхцөл хянагдахуйц, нэр бүр англи + монгол. Эх сурвалж = `backend/src/achievements/catalog.ts`.

## Стандарт

- **Нэр (EN):** Title Case, тоон дагавар/үсгийн алдаагүй (`Grammer`, `Figther`, `Buddy Bond2` засагдсан).
- **Нэр (MN):** `nameMn` — апп эхэлж үүнийг харуулна.
- **Шалгуур:** `condition` → апп `describeCondition()`-оор монгол өгүүлбэр болгоно (жишээ: «7 хоног дараалан суралцах»).
- **Slug өөрчлөгдөөгүй** — R2 дээрх зураг slug-аар хаягладаг.
- Шинэ нөхцөл **`level_complete`**: арлын нийтлэгдсэн бүх хичээлийг дуусгах (Lessons map-ийн done/total-тай яг ижил тоолол). Өмнө нь «удахгүй» гэж харагддаг байсан A1–B2 Finisher 4 трофей одоо авах боломжтой.

## Үлдсэн 68

| Ангилал | Slug | EN | MN | Нөхцөл |
|---|---|---|---|---|
| Streak | `starter_comeback_paw` | Comeback Paw | Эргэн ирсэн сарвуу | streak_days ≥ 3 |
| Streak | `bronze_weekly_flame` | Weekly Flame | 7 хоногийн гал | streak_days ≥ 7 |
| Streak | `silver_discipline_paw` | Discipline Paw | Тууштай сарвуу | streak_days ≥ 14 |
| Streak | `gold_monthly_grinder` | Monthly Grinder | Сарын тэмцэгч | streak_days ≥ 30 |
| Streak | `sapphire_iron_habit` | Iron Habit | Төмөр зуршил | streak_days ≥ 60 |
| Streak | `crystal_iron_habit2` | Hundred Day Habit | Зуун өдрийн зуршил | streak_days ≥ 100 |
| Streak | `ruby_half_year_spark` | Half Year Spark | Хагас жилийн оч | streak_days ≥ 180 |
| Streak | `mythic_one_year_spark` | One Year Spark | Нэг жилийн оч | streak_days ≥ 365 |
| Арал | `gold_a1_finisher` | A1 Finisher | A1 арлыг туулагч | level_complete level: A1 ≥ 100 |
| Арал | `sapphire_a2_finisher` | A2 Finisher | A2 арлыг туулагч | level_complete level: A2 ≥ 100 |
| Арал | `crystal_b1_finisher` | B1 Finisher | B1 арлыг туулагч | level_complete level: B1 ≥ 100 |
| Арал | `emerald_b2_finisher` | B2 Finisher | B2 арлыг туулагч | level_complete level: B2 ≥ 100 |
| Сорил | `starter_first_quiz` | First Quiz | Анхны сорил | quiz_count ≥ 1 |
| Сорил | `bronze_quiz_rookie` | Quiz Rookie | Сорилын шинэхэн | quiz_count ≥ 10 |
| Сорил | `silver_quiz_figther` | Quiz Fighter | Сорилын тэмцэгч | quiz_count ≥ 25 |
| Сорил | `gold_quiz_veteran` | Quiz Veteran | Сорилын ахмад | quiz_count ≥ 50 |
| Сорил | `sapphire_quiz_architect` | Quiz Architect | Сорилын мастер | quiz_count ≥ 100 |
| Сорил | `ruby_quiz_legend1` | Quiz Legend | Сорилын домог | quiz_count ≥ 250 |
| Төгс сорил | `silver_perfect_five` | Perfect Five | Төгс тав | quiz_perfect ≥ 5 |
| Төгс сорил | `gold_perfect_ten` | Perfect Ten | Төгс арав | quiz_perfect ≥ 10 |
| Төгс сорил | `sapphire_perfect_twenty` | Perfect Twenty | Төгс хорь | quiz_perfect ≥ 20 |
| Төгс сорил | `emerald_perfect_fifty` | Perfect Fifty | Төгс тавь | quiz_perfect ≥ 50 |
| Сорил | `starter_grammer_badge` | Grammar Badge | Дүрмийн тэмдэг | quiz_count skill: 'fill' ≥ 1 |
| Сорил | `silver_grammar_builder1` | Grammar Builder | Дүрэм бүтээгч | quiz_count skill: 'fill' ≥ 10 |
| Сорил | `gold_grammar_builder2` | Grammar Expert | Дүрмийн мэргэжилтэн | quiz_count skill: 'fill' ≥ 25 |
| Сорил | `sapphire_a1_grammar_master` | Grammar Master | Дүрмийн мастер | quiz_count skill: 'fill' ≥ 50 |
| Сорил | `crystal_grammar_master3` | Grammar Legend | Дүрмийн домог | quiz_count skill: 'fill' ≥ 100 |
| Сорил | `starter_mini_listener` | Mini Listener | Бяцхан сонсогч | quiz_count skill: 'listening' ≥ 1 |
| Сорил | `silver_listening_builder1` | Listening Builder | Сонсголын бүтээгч | quiz_count skill: 'listening' ≥ 10 |
| Сорил | `gold_listening_builder2` | Listening Expert | Сонсголын мэргэжилтэн | quiz_count skill: 'listening' ≥ 25 |
| Сорил | `sapphire_listening_master` | Listening Master | Сонсголын мастер | quiz_count skill: 'listening' ≥ 50 |
| Сорил | `crystal_listening_master2` | Listening Legend | Сонсголын домог | quiz_count skill: 'listening' ≥ 100 |
| Сорил | `bronze_sentence_maker` | Sentence Maker | Өгүүлбэр зохиогч | quiz_count skill: 'writing' ≥ 5 |
| Үг | `starter_first_word` | First Word | Анхны үг | words_learned ≥ 1 |
| Үг | `bronze_word_paw` | Word Paw | Үгийн сарвуу | words_learned ≥ 25 |
| Үг | `silver_word_hunter` | Word Hunter | Үгийн анчин | words_learned ≥ 100 |
| Үг | `gold_word_collector` | Word Collector | Үг цуглуулагч | words_learned ≥ 250 |
| Үг | `ruby_lexicon_beast1` | Lexicon Beast | Үгийн баатар | words_learned ≥ 1000 |
| Бат цээжилсэн үг | `crystal_word_master1` | Word Master | Үгийн мастер | words_mature ≥ 100 |
| Бат цээжилсэн үг | `ruby_no_translation_needed_2` | No Translation Needed | Орчуулга хэрэггүй | words_mature ≥ 250 |
| Бат цээжилсэн үг | `emerald_no_translation_needed1` | Living Memory | Амьд санах ой | words_mature ≥ 500 |
| Карт | `starter_first_swipe` | First Swipe | Анхны карт | cards_swiped ≥ 1 |
| Карт | `bronze_card_starter` | Card Starter | Картын эхлэгч | cards_swiped ≥ 50 |
| Карт | `silver_card_hunter` | Card Hunter | Картын анчин | cards_swiped ≥ 200 |
| Карт | `gold_card_collector1` | Card Collector | Карт цуглуулагч | cards_swiped ≥ 500 |
| Карт | `sapphire_card_collector` | Card Master | Картын мастер | cards_swiped ≥ 1000 |
| Карт | `ruby_card_legend1` | Card Legend | Картын домог | cards_swiped ≥ 2500 |
| Алдаа засах | `starter_one_more_try` | One More Try | Дахиад нэг оролдлого | mistakes_fixed ≥ 1 |
| Алдаа засах | `bronze_mistake_fixer` | Mistake Fixer | Алдаа засагч | mistakes_fixed ≥ 5 |
| Алдаа засах | `gold_mistake_slayer1` | Mistake Slayer | Алдааны дайсан | mistakes_fixed ≥ 25 |
| Алдаа засах | `crystal_mistake_slayer_2` | Mistake Hunter | Алдааны анчин | mistakes_fixed ≥ 50 |
| Алдаа засах | `emerald_mistake_slayer3` | Mistake Destroyer | Алдааг устгагч | mistakes_fixed ≥ 150 |
| AI найз | `starter_hello_buddy` | Hello Buddy | Сайн уу, найзаа | buddy_sessions ≥ 1 |
| AI найз | `bronze_buddy_bond` | Buddy Bond | Найзын холбоо | buddy_sessions ≥ 10 |
| AI найз | `silver_buddy_bond2` | Close Buddy | Дотно найз | buddy_sessions ≥ 25 |
| AI найз | `gold_conversation_figther` | Conversation Fighter | Ярианы тэмцэгч | buddy_sessions ≥ 50 |
| AI найз | `crystal_buddy_loyalist` | Buddy Loyalist | Үнэнч найз | buddy_sessions ≥ 100 |
| AI найз | `ruby_buddy_soul_mate` | Buddy Soul Mate | Сэтгэлийн найз | buddy_sessions ≥ 200 |
| AI найз | `mythic_ai_circle_master` | AI Circle Master | AI найзуудын тойрог | buddy_distinct ≥ 5 |
| AI найз | `starter_first_voice` | First Voice | Анхны дуу хоолой | buddy_sessions mode: VOICE ≥ 1 |
| AI найз | `bronze_brave_speaker` | Brave Speaker | Зоригтой илтгэгч | buddy_sessions mode: VOICE ≥ 5 |
| AI найз | `silver_voice_builder` | Voice Builder | Дуу хоолой бүтээгч | buddy_sessions mode: VOICE ≥ 20 |
| AI найз | `sapphire_fluency_engine` | Fluency Engine | Чөлөөт ярианы хөдөлгүүр | buddy_sessions mode: VOICE ≥ 50 |
| AI найз | `crystal_fluency_engine2` | Fluency Pro | Чөлөөт ярианы мэргэжилтэн | buddy_sessions mode: VOICE ≥ 100 |
| AI найз | `mythic_fluent_fox1` | Fluent Fox | Чөлөөтэй ярьдаг үнэг | buddy_sessions mode: VOICE ≥ 250 |
| Оч | `starter_first_spark` | First Spark | Анхны оч | sparks_total ≥ 1 |
| XP | `ruby_xp_beast` | XP Beast | XP-ийн баатар | xp_total ≥ 50000 |
| Мета | `celestial_the_crowned_fox` | The Crowned Fox | Титэмтэй үнэг | trophy_count ≥ 50 |

## Хасагдсан 32

Шалтгаан: давхардсан шат (дуут яриа 5/10/20/25; «Quiz Champion» = «Perfect N»-тэй ижил статистик; 100-аас дээших олон grammar/listening master), хүрэх боломжгүй босго (10,000,000 XP, 730 хоногийн streak, 10,000 карт), «үг хадгалах» (товшилт, амжилт биш).

Аль хэдийн авсан хэрэглэгчийн `user_trophies` мөр **устгагдаагүй** — зүгээр л харуулахгүй, тоолохгүй, «The Crowned Fox»-д тооцохгүй (`CATALOG_SLUGS` шүүлтүүр).

- `bronze_image_guesser`
- `bronze_pronounciation_rookie`
- `celestial_eternal_habit`
- `celestial_fluency_trial3`
- `celestial_fluent_fox2`
- `celestial_grand_collector3`
- `celestial_legend_card3`
- `celestial_mistake_destroyer`
- `celestial_quiz_immortal`
- `celestial_the_eternal_spark`
- `crystal_quiz_champion2`
- `crystal_rare_card_hunter`
- `emerald_epic_card_hunter`
- `emerald_grammar_master4`
- `emerald_hundred_day_fox`
- `emerald_listening_master3`
- `emerald_quiz_champion3`
- `emerald_word_master3`
- `mythic_card_legend2`
- `mythic_english_xp_champion`
- `mythic_fluency_trial2`
- `mythic_grand_collector1`
- `mythic_lexicon_beast2`
- `mythic_living_dictionary`
- `mythic_mistake_slayer4`
- `mythic_quiz_legend2`
- `ruby_fluency_trial1`
- `ruby_grammar_complationist`
- `ruby_listening_master_4`
- `sapphire_a2_grammar_master`
- `sapphire_quiz_champion`
- `silver_emotion_speaker`
