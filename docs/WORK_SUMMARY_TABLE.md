# SparkXP — Хийсэн ажлын нэгтгэл (Boju)

> Огноо: 2026-08-06 · Branch: `boju`

## A. UI Redesign (PR #189)

| Дэлгэц | Гол өөрчлөлт | Файл |
|---|---|---|
| Profile (§3.3) | Crown-gradient status card (avatar+ring+level, @username, chip, 4 stat icon+тоо) | `app/(tabs)/profile.tsx` |
| Home (§3.1) | Continue=float, 3 өнгөт glow стат карт, hearts pill, gradient skill grid, rail | `app/(tabs)/index.tsx` |
| Lessons map (§3.2) | 4 island төлөв (ЭНД БАЙНА pulse / mastered / unlocked / locked) | `app/(tabs)/lessons.tsx` |
| Node path (§3.2b) | 4 node төлөв + "ЭНД" flag + trail travelled/ahead | `app/level/[code].tsx` |

**Төлөв:** ✅ push + PR #189.

---

## B. Task 1 — Core Gamification (full-stack)

| Feature | Backend | Mobile | Шинэ API | DB / Migration |
|---|---|---|---|---|
| **Lesson Stars** | `UserLessonStar` entity, `StarsService`, quiz-submit-д од олгоно | Node path-д од (0–3) | `GET /gamification/stars` | `user_lesson_stars` table |
| **Castle unlock** | `levelUnlocks` (computed) + `LevelRequirement` (admin-tunable) | Island star-gated lock + unlock burst анимаци | `getGamification.levelUnlocks` | `level_requirements` table (seed) |
| **Events** | `EventsModule`, `Event` entity, admin CRUD | Home Events card + live countdown | `GET /events/active` + admin CRUD | `events` table (+enum) |
| **Double XP** | `XpService.award` multiply (active `double_xp` эвэнт) | — | — | — |
| **Leaderboard preview** | `getTopList` reuse | Home Top-3 card → full board | `GET /leaderboard/preview` | — |

**Migration:** `1786800000000-CreateGamificationTables` (3 table + enum + seed).
**Төлөв:** ✅ хэрэгжсэн (tsc цэвэр). API.md шинэчилсэн.

---

## C. Task 2 — Дэлгэрэнгүй features

### ✅ Хийгдсэн

| Feature | Backend | Mobile | Шинэ API | DB / Migration |
|---|---|---|---|---|
| **AI Buddy session** (extend) | `buddy.service`: `endSession` (duration), `getStatistics` | `chat.tsx`: session дуусгах + stats; `BuddyStatsRow` компонент | `POST /ai/buddy/sessions/:id/end` · `GET /ai/buddy/statistics` | ❌ (existing багана) |
| **Lesson Stars** (extend) | `UserLessonStar`: +`bestScore`+`completedAt`; `StarsService`: best-of + `recordLessonResult`; `LessonStarsController` | `api/gamification.ts`: `getLessonStarsDetailed`, `postLessonResult` | `GET /lesson-stars` · `POST /lesson-result` | `1786900000000` (+2 багана) |

### ⏳ Үлдсэн (энэ дараалалаар)

| # | Feature | Төлөвлөгөө | Migration |
|---|---|---|---|
| 2 | **Castle Unlock** | `GET /castles` · `POST /castle/unlock` (computed reuse) | ❌ |
| 3 | **Leaderboard Top 3** | `GET /leaderboard/top3` | ❌ |
| 4 | **Events** | `GET /events` (active alias) | ❌ |
| 5 | **Analytics** | ШИНЭ module (xp_logs aggregation): `/analytics`, `/dashboard`, `/history` | ❌ |
| 6 | **Buddy Background Shop** | ШИНЭ: `BuddyBackground`+`UserBuddyBackground`, buy/equip | ✅ 2 table |

---

## Дүрэм (баримталсан)
- Одоо байгаа entity/service/module-ыг **reuse + extend** (duplicate table/API үүсгээгүй).
- Migration зөвхөн schema өөрчлөгдсөн үед.
- Backward compatible, production-ready, mock дата ашиглаагүй.
