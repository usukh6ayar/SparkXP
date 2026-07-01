# SparkXP (EnglishXP) — Багийн цаашдын төлөвлөгөө & хэрэгжүүлэх зүйлс

> Эх сурвалж: `docs/` доторх бүх баримт (IT Team Brief, Strategy Recommendations,
> 34,000₮ / 56,000₮ Plan cost breakdown, SparkXP Plan, Teacher Panel UI/UX).
> Нэгтгэсэн огноо: **2026-07-01**. Owner: Hustle Hive LLC / Gantulga Lkhagvadorj.

Энэ файл нь docs доторх бүх баримтыг уншиж, багийн **цаашид хийх ажил** болон
**ирээдүйд хэрэгжүүлэх зүйлсийг** нэг дор нэгтгэсэн ажлын жагсаалт. Дэлгэрэнгүй
техникийн дүрмийг эх docx-уудаас лавлана.

---

## 1. Одоогийн байдал (2026-06-30 хүртэл хэрэгжсэн)

### Mobile (сурагчийн апп)
- **Auth:** бүртгэл, нэвтрэх (username/email), имэйл баталгаажуулалт, нууц үг сэргээх.
- **Нүүр:** XP, Sparks, Streak, Continue Learning, өдрийн зорилго.
- **Хичээл:** видео хичээл + хичээлийн дараах тест (Сонсгол/Унших/Бичих/Ярих).
- **Дасгал:** бие даасан дасгал (4 skill).
- **Үг сурах:** Swipe карт, үг хадгалах, SRS давталт.
- **Унших материал:** англи текст, үг дээр дарж орчуулга + дуудлага.
- **Хэлц үг (Idioms):** утга, жишээ, дуудлага, зурагтай тайлбар.
- **Сорил/тест:** Multiple Choice, Fill in the Blank, Word Matching + XP.
- **AI Найз:** text chat (англиар ярилцах).
- **Бусад:** Leaderboard, Profile, Avatar.
- **Багшийн хэсэг:** анги үүсгэх, код/QR-аар элсүүлэх, сурагч батлах, даалгавар оноох.

### Admin (веб удирдлага)
- Контент: Хичээл, Үг, Сорил, Унших материал, Хэлц үг, Дасгал.
- AI контент: текст (Gemini), зураг (OpenAI), дуудлага (ElevenLabs).
- CSV / Bulk import, олон контент нэг дор нийтлэх.
- Хэрэглэгч / Анги / Байгууллагын удирдлага.
- Төлбөр & багц, AI хэрэглээний статистик, Push мэдэгдэл, Leaderboard.

---

## 2. Ойрын хугацааны төлөвлөгөө (App Store launch зам)

| Хугацаа | Ажил |
| --- | --- |
| **2026.07.06 хүртэл** | Аппын үндсэн бүтэц бүрэн бэлэн, тест хийх боломжтой болно. |
| **07.06 – 07.09** | Алдаа засвар, UI/UX өнгөлгөө, App Store bundle бэлтгэл. |
| **2026.07.09** | App Store-д **анхны хувилбар** илгээх. |
| **07.09 – 08.10** | Шинэчлэлтүүдээр нэмэлт боломж, тогтвортой ажиллагаа. |
| **2026.08.10 – 08.15** | Төслийг бүрэн дуусгаж, production-д тогтвортой хүргэх. |

### 07.06 – 07.09 хийх ажлын жагсаалт (launch блокер)
- [ ] Mobile аппын **бүх үндсэн урсгалыг** гараар турших (auth → home → lesson → quiz → review).
- [ ] Илэрсэн алдаануудыг засах.
- [ ] UI/UX өнгөлгөө (шилжилт, spacing, Cyrillic фонт, loading/empty states).
- [ ] Performance сайжруулах (жагсаалт, зураг, API cache).
- [ ] App Store material: **Icon, Screenshots, Description** бэлтгэх.
- [ ] Placement / level сонголтын урсгал шалгах (A1–B1).
- [ ] Прод migration бүрэн гүйцэх: `reading_passages`, `translations`, `idioms`,
      `synonyms/antonyms` багана, `reading` enum утга (`DB_SYNCHRONIZE=false`).

---

## 3. Цаашид хэрэгжүүлэх боломжууд (Post-launch roadmap)

| Боломж | Тайлбар | Төлөвлөсөн хугацаа |
| --- | --- | --- |
| **AI Найз (Voice Chat)** | AI-тай дуу хоолойгоор ярилцах, төрөлжсөн AI багш | 2026.07.09–08.15 |
| **Speaking Practice** | Дуудлага шалгах, Speech Recognition (STT) | 2026 оны 8-р сар |
| **QPay төлбөр** | Premium багцын бодит төлбөрийн систем | 2026.07.09–08.15 |
| **Reading шинэчлэлт** | Ахиц хадгалах, номын сан, шинэ үгийн статистик, аудио дагаж унших | 2026 оны 8-р сар |
| **Badge & Push Notification** | Achievement badge, push, streak сайжруулалт | 2026.07.09–08.15 |
| **Performance & Stability** | Cache, server optimization, error monitoring | Тогтмол |

### Дараагийн үе шат (Later — Strategy/Brief-ээс)
- **AI Buddy marketplace** — мэргэжлийн (Police, Doctor, Lawyer, SW Engineer,
  Business) дүрт AI багш нар; roleplay, interview simulation.
- **Duolingo-style lesson path** (жагсаалтын оронд зам), нүүр = ганц "Continue Learning".
- **Card battle / rare-epic card pack**, profession scenario games.
- **Secure exam mode** (шалгалтын горим), full audiobook library.
- **Live teacher platform**, creator AI buddies, олон улсын өргөтгөл.

---

## 4. AI & Voice стратеги (заавал барих guardrail)

> Гол зарчим: AI бол **сурах туслах**, хязгааргүй chatbot биш. Өндөр үнэ цэн +
> урьдчилан таамаглах боломжтой зардал. Валют planning: **1 USD ≈ 3,600₮**
> (backend дээр ханш + vendor pricing-ийг **config**-оор хадгална).

### Технологийн хуваарь
- **Text AI:** GPT-4-mini-class / Gemini — тайлбар, засвар, богино дадлага.
- **Voice (TTS):** ElevenLabs Flash v2.5 / Turbo — `$0.05 / 1,000 chars`.
- **STT:** ElevenLabs Scribe (Realtime `$0.39/hr`, alt `$0.22/hr`), **VAD** ашиглаж
  чимээгүй секунд тооцохгүй.
- **AI Dictionary:** Gemini 2.5 Flash-Lite (`$0.10` in / `$0.40` out / 1M tokens),
  **cache first** — ижил үгийг дахин AI-аар үүсгэхгүй, DB/cache-аас буцаана.

### AI reply дүрэм
- Богино reply (**8–15 сек**), нэг удаад **нэг л correction**, дараа нь асуулт.
- Long lecture/essay voice reply **хориглоно**.
- Voice cap-д хүрэхэд: voice зогсоод **text mode үргэлжилнэ**, reset timer + upgrade.
- 80% ба 95% дээр warning.
- AI Dictionary: Google Search grounding **default OFF**, output ≤ ~500 token.

### Хэрэгжүүлэх сануулга
- Бүх AI дуудалт **AI Gateway** module дундуур (per-user limit, log, cost tracking).
- Plan limit-үүд (voice минут, token, Sparks rate) **admin/DB-ээс config** — апп
  шинэчлэлгүйгээр өөрчилдөг байх.

---

## 5. Plan / Monetization

| Үзүүлэлт | Standard (34,000₮) | Premium (56,000₮) |
| --- | --- | --- |
| AI Buddy voice | 25 мин/сар (~185 reply) | 50 мин/сар (~3+ цаг feeling) |
| STT user speech | ~75 мин | 100–120 мин |
| AI Dictionary | 300 үг/сар | 700 үг/сар |
| AI Buddy memory | 100MB cap | 250MB cap |
| Text chat fair-use | — | 400k token cap |
| Bonus | — | 1.5x Sparks + premium buddy/card pack |
| Дээд operating cost | ~13,000₮ (safe ~12,850₮) | 20,000₮ ceiling |
| Gross profit / user | ~21,150₮ (62.2%) | ~36,000₮ (64.3%) |

- **Free plan:** хязгаартай хичээл + AI хэрэглээ (funnel).
- Төлбөр: **QPay / карт / local** (App Store IAP-аас аль болох зайлсхийх, ~3–4% fee reserve).
- Memory архитектур: store → index/search → relevant retrieve → **tiny summary**-г
  л AI руу явуулна (бүх memory-г prompt болгож явуулахгүй).

---

## 6. Teacher Panel (in-app) — дараагийн том feature

> Student app = сурдаг тал · **Teacher panel = хянаж чиглүүлдэг тал** · Admin = business/system.
> Утга: language center / school-д зарах, retention өсгөх гол хөшүүрэг.

**4 дэлгэц:**
1. **Dashboard** — Total/Active students, Average progress, Speaking this week, My Classes.
2. **Class Detail** — completion, weakest topic, performance graph (4 долоо хоног), top weak topics.
3. **Student Progress** — skill breakdown (Grammar/Vocab/Listening/Speaking), common mistakes + AI suggestion, feedback.
4. **Assign Task** — task types (Vocabulary Set, Grammar, Speaking, Listening, Mock Test), class/selected students, due date, note.

**Backend-д хэрэгтэй:**
- `teacher_id` дээр dashboard aggregate; `speaking_minutes_week` (AI logs-оос долоо хоногоор).
- `skill_scores` (grammar/vocab/listening/speaking), `mistakes` (sentence, type, corrected_form, frequency).
- `weakest_topic` = mistake frequency + score; weekly aggregate хадгалах/динамик тооцоо.
- `assignments` (task_type, target_type, class_id/student_ids, due_date, note, created_by) +
  `assignment_submissions` (status, score, submitted_at, attempt_count).
- Student app-д task notification + pending tasks list.
- AI suggestion = **rule-based + LLM** хосолсон.

---

## 7. Контент & хууль зүйн дүрэм
- Бүх контент **эх бүтээл эсвэл хууль ёсны лицензтэй**. Албан сурах бичиг, төлбөртэй
  толь бичиг, зохиогчийн эрхтэй ном, брэнд дүрийг хуулахгүй.
- Сургалтын хөтөлбөрийг зөвхөн **alignment blueprint** болгон ашиглана (goal, grammar target, difficulty).
- A1–A2: энгийн, visual, practical. B1–B2: гүн grammar/listening/reading/speaking.
- Listening MVP = **1–3 минутын** богино passage (audiobook биш).
- Passive learning бүрт **proof of understanding** (quiz/task/short answer) байж XP бүрэн олгоно.
- Дуу хоолой: алдартай хүний дуу хуулахгүй; багшийн дуу зөвхөн бичгэн зөвшөөрөл + commercial лицензтэйгээр.

---

## 8. Архитектур / дэд бүтэц (Strategy recommendation)
- **Stack:** NestJS + PostgreSQL + Redis + **BullMQ** + Cloudflare R2 / MinIO.
- PostgreSQL = primary (олон relation, transaction, XP log, leaderboard, class, payment, org).
- Redis = cache, rate limit, **leaderboard acceleration** (ZSET хэрэгцээ гарахад).
- **Speaking AI (STT → AI → TTS)** нь гол bottleneck болно → queue + worker-ээр тусгаарлах
  (PostgreSQL биш).
- UUID PK, jsonb flexible content, бүх table `created_at/updated_at`.

---

## 9. Багийн бүтэц

| Гишүүн | Үүрэг | Branch |
| --- | --- | --- |
| **Өсөхбаяр** (Senior/Lead) | Backend + Admin, ерөнхий удирдлага | `usukhbayar` |
| **Бишрэлт** | Backend endpoints (mobile + admin), `API.md` | `bishrelt` |
| **Чойжамц (Choi)** | Mobile — learning core (Auth/Home/Lessons/Review/Swipe) | `choi` |
| **Батсайхан (Boju)** | Mobile — games & social (Quiz/Soril/AI chat/Leaderboard/Teacher) | `boju` |

> Git: task бүр эхлэхийн өмнө `main` pull. `main` руу шууд push хийхгүй, PR + review.
> Shared файл (`theme.ts`, `components/`, `API.md`, `_layout.tsx`) = announce → tiny PR → merge fast.

---

## 10. Дүгнэлт
- **07.09:** App Store-д анхны ажиллагаатай хувилбар (үндсэн сурах боломжууд бүрэн).
- **08.15:** AI voice, Speaking, QPay, badge/push, reading шинэчлэлтийг шат дараатай нэмж,
  бүрэн ажиллагаатай тогтвортой бүтээгдэхүүн.
- **Дараагийн давалгаа:** AI Buddy marketplace, lesson path, card battle, exam mode, live teacher, олон улс.
