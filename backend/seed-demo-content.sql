-- Dev/demo seed for the newly-added, data-dependent screens.
-- Run against YOUR dev DB (check backend/.env → DB_NAME; default: sparkxp):
--   psql -d sparkxp -f backend/seed-demo-content.sql
-- Safe to re-run: existing rows with the same name/title are skipped.

-- AI Buddy backgrounds (the "Орчин" shop). Empty shop = these are missing.
INSERT INTO buddy_backgrounds (name, image_url, price_sparks, is_premium, is_active, sort_order)
SELECT * FROM (VALUES
  ('Ой мод',        'https://picsum.photos/seed/forest/800/500', 0,   false, true, 1),
  ('Сансар',        'https://picsum.photos/seed/space/800/500',  50,  false, true, 2),
  ('Уулс',          'https://picsum.photos/seed/mountain/800/500', 80, false, true, 3),
  ('Premium далай', 'https://picsum.photos/seed/ocean/800/500',  100, true,  true, 4)
) AS v(name, image_url, price_sparks, is_premium, is_active, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM buddy_backgrounds b WHERE b.name = v.name);

-- Home events (Daily + a live Double-XP window).
INSERT INTO events (type, title, description, starts_at, ends_at, reward_xp, xp_multiplier, is_active)
SELECT * FROM (VALUES
  ('daily'::text,     'Өдрийн зорилт', 'Өнөөдөр 50 XP цуглуулаарай!',        now(), now() + interval '1 day',   20,   NULL::numeric, true),
  ('double_xp'::text, '2X XP цаг',     'Дараагийн 3 цагт бүх XP хоёр дахин!', now(), now() + interval '3 hours', NULL, 2.00,          true)
) AS v(type, title, description, starts_at, ends_at, reward_xp, xp_multiplier, is_active)
WHERE NOT EXISTS (SELECT 1 FROM events e WHERE e.title = v.title);

-- Idioms (Хэлц үг). Published so students see them; admin can add images/audio.
INSERT INTO idioms (phrase, mongolian, meaning, definition, example_sentence, example_translation, is_published)
SELECT * FROM (VALUES
  ('Break the ice',          'Мөс хайлуулах',        'Танилцах, эвгүй чимээгүйг арилгах',       'To initiate conversation and ease tension',      'He told a joke to break the ice.',              'Тэр эвгүй байдлыг арилгахын тулд онигоо ярьсан.', true),
  ('Piece of cake',          'Маш амархан зүйл',     'Хийхэд маш хялбар',                       'Something very easy to do',                      'The exam was a piece of cake.',                 'Шалгалт маш амархан байлаа.',                    true),
  ('Hit the books',          'Шаргуу хичээллэх',     'Идэвхтэй суралцах, хичээлдээ анхаарах',    'To study hard',                                  'I need to hit the books before the test.',      'Шалгалтын өмнө би шаргуу хичээллэх хэрэгтэй.',   true),
  ('Under the weather',      'Бие сайнгүй байх',     'Өвчтэй, тааруу байх',                      'To feel ill',                                    'She is feeling under the weather today.',       'Тэр өнөөдөр бие сайнгүй байна.',                 true),
  ('Once in a blue moon',    'Маш ховор',            'Ховорхон тохиолддог',                      'Very rarely',                                    'We meet once in a blue moon.',                  'Бид маш ховор уулздаг.',                         true),
  ('Cost an arm and a leg',  'Маш үнэтэй',           'Их үнэ шаардсан',                          'To be very expensive',                           'That car cost an arm and a leg.',               'Тэр машин маш үнэтэй байсан.',                    true),
  ('Spill the beans',        'Нууц задлах',          'Санамсаргүй нууц дэлгэх',                  'To reveal a secret',                             'Don''t spill the beans about the party.',       'Үдэшлэгийн тухай нууцыг бүү задал.',              true),
  ('Call it a day',          'Өдрийг өндөрлөх',      'Ажлаа зогсоох, амрах',                     'To stop working for the day',                    'We worked hard, let''s call it a day.',         'Бид шаргуу ажиллалаа, өдрийг өндөрлөе.',          true)
) AS v(phrase, mongolian, meaning, definition, example_sentence, example_translation, is_published)
WHERE NOT EXISTS (SELECT 1 FROM idioms i WHERE i.phrase = v.phrase);
