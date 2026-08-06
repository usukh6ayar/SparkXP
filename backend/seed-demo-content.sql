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
