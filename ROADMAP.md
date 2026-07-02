# SparkXP — ROADMAP (хэн юу хийх + Launch + Update давалгаанууд)

> Шинэчилсэн: **2026-07-01**. Дэлгэрэнгүй бүтээгдэхүүн/зардал/ирээдүйн төлөвлөгөө:
> **`docs/FUTURE_PLAN.md`**. Багийн дүрэм: **`CLAUDE.md`**.
>
> **Гол огноо:** `07.09` — App Store-д анхны хувилбар · `08.15` — бүрэн дуусгах.
> **Push:** өөрийн branch → PR → `main` (GitHub `origin`). Task бүрийн өмнө `main` pull.

---

## 1. Хэн юу хийх (owners)

| Dev | Хариуцах хэсэг | Branch | Гол ажил |
| --- | --- | --- | --- |
| **Өсөхбаяр** (lead) | `/backend` + `/admin` | `usukhbayar` | Endpoints, DB, migration, admin panel, prod deploy (Railway), `API.md` |
| **Choi** | `/mobile` learning core | `choi` | Auth, Home, Lessons (list+detail), Reading, Review/SRS, Swipe + Saved |
| **Boju** | `/mobile` games & social | `boju` | Quiz/Soril, AI chat, Idioms, Leaderboard, Profile/Avatar/Assignments, Teacher, Join |

**Дүрэм:** Choi/Boju нь `/backend` шууд засахгүй → endpoint-ийг Өсөхбаяр-аас
хүсэн авна. Shared mobile файл (`theme.ts`, `components/`, `_layout.tsx`) →
эхлээд CLAUDE.md-д зарлаад, жижиг PR-аар оруулна.

---

## 2. Одоо хэрэгжсэн (baseline — 2026-06-30)

Дэлгэрэнгүйг `docs/FUTURE_PLAN.md → §1`. Товчоор:
- **Mobile:** Auth, Home (XP/Streak/Continue), Lessons + видео + дараах тест,
  Дасгал, Swipe үг + SRS, Reading (tap-to-translate), Idioms, Сорил, AI text chat,
  Leaderboard, Profile/Avatar, Багшийн хэсэг (анги/QR/батлах/даалгавар).
- **Admin:** Хичээл/Үг/Сорил/Reading/Idiom/Дасгал контент + AI үүсгэлт (Gemini
  текст, OpenAI зураг, ElevenLabs дуу), CSV/Bulk, Хэрэглэгч/Анги/Байгууллага,
  Төлбөр/багц, AI статистик, Push, Leaderboard.

---

## 3. App Store-д гаргахаас ӨМНӨ хийх ажил (07.01 → 07.09) 🚀

> Энэ бол **launch блокер** жагсаалт. 07.06 гэхэд тест хийх боломжтой болж,
> 07.06–09 өнгөлгөө хийж, **07.09-нд App Store-д илгээнэ**.

### Өсөхбаяр (Backend + Admin)
- [ ] **Прод migration бүрэн гүйцэх** (`DB_SYNCHRONIZE=false` дээр гараар):
      `reading_passages`, `translations`, `idioms` table + `synonyms`/`antonyms`
      багана + `reading` enum утга. (`src/migrations/` шалгах.)
- [ ] **AI Buddy voice (branch `feature/ai-buddy-backend`)** — прод migration
      `CreateAiBuddyVoice1782400000000` (шинэ `buddy_sessions`/`buddy_memories`/
      `buddy_voice_cache`/`safety_events` table + `messages`/`ai_buddies` багана).
      Шинэ env: `STT_PROVIDER`/`LLM_PROVIDER`/`TTS_PROVIDER`/`AI_BUDDY_LOG_RAW_AUDIO`/
      `AI_BUDDY_AUDIO_RETENTION_DAYS`. Дэлгэрэнгүй: `docs/AI_BUDDY_PLAN.md`.
      Дараагийн: admin UI (Part 2), mobile+3D avatar (Part 3/4 — Boju).
- [ ] Prod дээр бүх шинэ endpoint ажиллаж буйг шалгах (Railway).
- [ ] `.env.example` бүрэн (бүх шаардлагатай key placeholder-тэй); real key
      commit хийгдээгүйг баталгаажуулах.
- [ ] AI usage limit / rate-limit prod дээр асаалттай эсэхийг шалгах.
- [ ] Admin бүх list page pagination + bulk ажиллаж буйг шалгах.
- [ ] `API.md`-г одоогийн endpoint-уудтай тааруулж шинэчлэх.

### Choi (Mobile — learning core)
- [ ] Auth → Home → Lesson → Quiz → Review бүх урсгалыг **гараар турших**, алдаа засах.
- [ ] Placement / level сонголтын урсгал (A1–B1) шалгах.
- [ ] Reading tap-to-translate + audio prod дээр ажиллаж буйг шалгах.
- [ ] Loading / empty / error state-үүд бүх дэлгэц дээр байх.
- [ ] Жагсаалт + зураг performance (FlatList, image cache).

### Boju (Mobile — games & social)
- [ ] Quiz/Soril, Idioms, Leaderboard, Profile, Teacher, Join урсгалыг турших, алдаа засах.
- [ ] AI chat prod endpoint-той холбогдож буйг шалгах (limit warning харагдана).
- [ ] Багшийн урсгал (анги үүсгэх → QR/код → сурагч батлах → даалгавар) бүрэн тест.

### Хамтын (launch bundle — 07.06–09)
- [ ] UI/UX өнгөлгөө: Cyrillic фонт (Onest/Inter) ачаалах, spacing, шилжилт.
- [ ] **App icon** файлууд нэмэх (одоо байхгүй).
- [ ] App Store material: **Icon, Screenshots, Description** бэлтгэх.
- [ ] Бодит gamification өгөгдөл (streak/level/progress placeholder-ийг солих).
- [ ] Бүх hardcoded content DB-рүү (Core Rule) — шалгах.
- [ ] Regression pass: гол урсгалуудыг бодит утсан дээр турших.

---

## 4. Launch-ийн ДАРАА — Update давалгаанууд 📦

> Бүх update `main` → Railway (backend/admin) + App Store update (mobile) руу
> шат дараатай гарна. Хугацаа = `docs/FUTURE_PLAN.md → §3`.

### 🌊 Update 1 — Payments & Engagement (07.09 – 08.15)
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| **QPay төлбөр** | Өсөхбаяр | Premium багцын бодит төлбөр (Payment entity + QPay webhook + багц config) |
| Багц/plan limit config | Өсөхбаяр | Voice/token/dictionary/Sparks limit-ийг admin/DB-ээс (апп шинэчлэлгүй) |
| **Badge & Achievement** | Boju | Achievement badge систем + Profile дээр харуулах |
| **Push Notification** | Өсөхбаяр (BE) + Choi/Boju (FE) | Streak сануулга, даалгавар, шинэ контент push |
| Streak сайжруулалт | Choi | Streak freeze/reminder, өдрийн зорилго логик |

### 🌊 Update 2 — Speaking & Voice AI (2026 оны 8-р сар)
> ⚠️ Хамгийн өндөр зардалтай хэсэг → **AI Gateway + guardrail** заавал (FUTURE_PLAN §4).
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| **AI Найз Voice Chat** | Өсөхбаяр (BE) + Boju (FE) | ElevenLabs TTS, богино reply (8–15 сек), voice minute cap + 80/95% warning |
| **Speaking Practice / STT** | Өсөхбаяр (BE) + Boju (FE) | ElevenLabs Scribe STT + VAD, дуудлага шалгах, нэг correction |
| Төрөлжсөн AI багш | Өсөхбаяр + Boju | Мэргэжлийн buddy persona (эхний хувилбар) |
| AI Gateway limit/logging | Өсөхбаяр | Per-user limit, cost tracking, Message history — voice гарахаас өмнө |

### 🌊 Update 3 — Reading & Content 2.0 (2026 оны 8-р сар)
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| **Reading шинэчлэлт** | Choi | Ахиц хадгалах, номын сан, шинэ үгийн статистик, аудио дагаж унших |
| Vocabulary статистик | Choi | Сурсан үгийн тоо, mastery indicator |
| Контент нэмэлт | Өсөхбаяр (admin) | Илүү олон хичээл/үг/reading (A1–B2) |

### 🌊 Update 4 — Teacher Panel 2.0 (deep) (08.10 → цаашид)
> Дэлгэрэнгүй: `docs/FUTURE_PLAN.md → §6`. Language center/school-д зарах гол feature.
| Ажил | Owner | Тайлбар |
| --- | --- | --- |
| Teacher Dashboard | Boju (FE) + Өсөхбаяр (BE) | Total/Active students, avg progress, speaking this week |
| Class Detail | Boju + Өсөхбаяр | Weakest topic, performance graph, top mistakes |
| Student Progress | Boju + Өсөхбаяр | Skill breakdown, common mistakes + AI suggestion, feedback |
| Assign Task 2.0 | Boju + Өсөхбаяр | Task types, due date, submission tracking (`assignment_submissions`) |

### ♾️ Тогтмол — Performance & Stability
- Cache (Redis), server optimization, error monitoring, crash logs.
- Leaderboard-д Redis ZSET (scale хэрэгтэй болвол).
- Speaking AI-г queue/worker-т (BullMQ) тусгаарлах.

---

## 5. Дараагийн давалгаа (Later — тодорхой огноогүй)
`docs/FUTURE_PLAN.md → §3 (Later)`: AI Buddy marketplace, Duolingo-style lesson
path, card battle / rare-epic pack, profession scenario games, secure exam mode,
full audiobook library, live teacher platform, creator AI buddies, олон улсын өргөтгөл.

---

## 6. Timeline (нэг харцаар)

```
07.01 ──────── 07.06 ──── 07.09 ──────────────── 08.10 ──── 08.15
  │              │           │                       │          │
  launch блокер  тест       App Store               бүрэн     production
  ажил эхэлнэ    боломжтой  анхны хувилбар          дуусгах   тогтвортой
                            + Update 1–4 эхэлнэ
```
