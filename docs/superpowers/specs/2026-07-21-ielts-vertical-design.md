# SparkXP — IELTS хэсэг (vertical) · Design Spec

> Огноо: 2026-07-21 · Эзэн: Өсөхбаяр (backend + admin) · Mobile owner: TBD (Choi/Boju — coordinate)
> Статус: **Approved (brainstorming)** → дараагийнх: implementation plan (writing-plans).

## 1. Зорилго

SparkXP-д **IELTS шалгалтын бэлтгэлийн бүтэн хэсэг** нэмэх. 4 модуль
(Listening / Reading / Writing / Speaking), IELTS-ийн тусгай асуултын форматууд,
**band score 0–9** (L/R автомат), Writing/Speaking нь **практик + жишиг хариулт**
(self-study, автомат оноогүй). **AI шалгалт энэ хувилбарт ОРОХГҮЙ.**

**Арга барил (батлагдсан): Approach A — байгаа `Quiz`/контент дэд бүтцийг өргөтгөх**
(шинэ entity бага, quiz runner + admin editor + submit/scoring дахин ашиглах;
CODING_RULES: less code / DRY).

## 2. Хамрах хүрээ (scope)

**Phase 1 (ЭНЭ SPEC — MVP): модуль практик**
- 4 модуль тус бүрийн бие даасан практик дасгалууд.
- L/R: автомат band score. W/S: практик prompt + жишиг хариулт + band descriptor.
- Home-д IELTS orц → шинэ `/ielts` hub дэлгэц.
- Admin-д IELTS authoring.

**Phase 2 (ДАРАА — энэ spec-д БИШ): mock test**
- 4 модуль цуг, цаг таймтай бүрэн mock test + нийт band.
- Нимгэн бүлэглэгч entity `IeltsTest` (модуль quiz-үүдийг холбоно). Дараа тусдаа spec.

**Out of scope (энэ хувилбар):** AI essay/speaking grading, багшийн дүгнэлт (teacher
grading), офлайн, mock test, дуу хоолой бичих серверийн шинжилгээ.

## 3. Контент загвар (backend)

Одоогийн `Quiz` entity-г дахин ашиглана (`quizzes` table, jsonb `questions`).
**IELTS-ийн нэг Quiz = нэг IELTS секц/таск.**

### 3.1 `Quiz`-д нэмэх багана (migration шаардлагатай — prod `DB_SYNCHRONIZE=false`)
| Багана | Төрөл | Зорилго |
| --- | --- | --- |
| `passage_text` | `text`, nullable | Reading секцийн урт текст (Reading module) |
| `audio_url` | `varchar`, nullable | Listening секцийн аудио (нэг секцэд нэг бичлэг) |

> Тэмдэглэл: одоо байгаа `category`/`topic` талбарыг ашиглана — шинэ багана нэмэхгүй.
> `passage_text`/`audio_url` нь зөвхөн IELTS-д хэрэглэгдэх бөгөөд бусад quiz-д `null`.

### 3.2 Категори (`Quiz.category`) — шинэ утгууд
- `ielts_listening` · `ielts_reading` · `ielts_writing` · `ielts_speaking`
- `Quiz.topic` = дэд бүлэг/сэдэв (ж: "Academic Reading — Set 1"). Байгаа механизм.
- (Сонголт) `IELTS_CATEGORY_SUGGESTIONS` const admin-д (одоогийн suggestion-тэй адил).

### 3.3 Асуултын төрөл (jsonb `questions`)
IELTS форматын ихэнхийг **одоо байгаа төрлөөр** илэрхийлнэ (шинэ төрөл бага):
| IELTS формат | Ашиглах төрөл |
| --- | --- |
| True / False / Not Given | `multiple_choice` (options: True/False/Not Given) — admin preset |
| Multiple choice | `multiple_choice` |
| Matching headings / matching | `word_match` |
| Gap-fill / sentence / form completion | `fill_blank` |
| **Writing task / Speaking prompt** | **`open_response` (ШИНЭ)** |

**Шинэ төрөл `open_response`** (зөвхөн Writing/Speaking):
```ts
{ type: 'open_response',
  prompt: string,          // task/prompt текст
  imageUrl?: string,       // Writing Task 1 график/зураг
  modelAnswer: string,     // жишиг хариулт (self-study)
  bandNote?: string,       // band descriptor / зөвлөмж
  points: 0 }              // оноогүй (авто-grade хийхгүй)
```
- `scoreSubmission`/`gradeQuestion`-д `open_response` нь **үргэлж correct=false, points=0**
  (оноонд нөлөөлөхгүй) эсвэл grading-аас алгасна. W/S нь submit хийдэггүй — доор §5.3.
- `validateQuestions`-д `open_response` салбар нэмнэ; мөн IELTS-д хэрэгтэй бол MCQ-д
  `imageUrl` талбар хадгалагдахаар өргөтгөнө (одоо strip хийдэг).

### 3.4 Band score helper (backend)
`ielts-band.ts` (эсвэл `quizzes` доторх helper):
```ts
ieltsBand(module: 'listening'|'reading', correct: number, total: number): number
```
- Стандарт IELTS conversion 40 асуултад тохирдог. Практик секц бага асуулттай тул
  **хувиар (correct/total) ойролцоолж band-д буулгана** (0.5 алхамтай, 0–9).
- Result-д `{ band, correct, total }` буцаана (L/R). W/S band-гүй.

## 4. API өөрчлөлт

| Endpoint | Өөрчлөлт |
| --- | --- |
| `GET /quizzes?category=ielts_*&isPublished=true` | Байгаа шүүлт — IELTS модулийн жагсаалт татна (шинэ код бага) |
| `POST /quizzes/:id/submit` | L/R IELTS-д хариу дээр **`ieltsBand`** нэмж буцаана (category ielts_* үед). `awardOnce` хэвээр |
| `GET /quizzes/:id` | `passage_text`/`audio_url` + `open_response` асуултууд орно |
| `POST/PATCH /quizzes` | Admin authoring — шинэ талбар/төрөл хүлээж авна (DTO өргөтгөл) |

> Mock test (Phase 2) endpoint энэ spec-д БИШ. `API.md` шинэчилнэ.

## 5. Mobile

### 5.1 Home orц
- Home-д **IELTS banner/entry** (нэг мод, tab биш) → `/ielts` hub рүү нээнэ.
  5 дахь tab нэмэхгүй (таб дүүрэн). Байгаа banner/card component дахин ашиглана.

### 5.2 `/ielts` hub (шинэ дэлгэц)
- 4 модуль tile: Listening · Reading · Writing · Speaking (band өнгө/icon).
- Tile → тухайн модулийн практик жагсаалт (`GET /quizzes?category=ielts_<module>`)
  → runner. Байгаа `CategoryBrowser`/skill-list хэв маягийг дагана.

### 5.3 Runner
- **L/R:** одоогийн **quiz runner-ийг дахин ашиглана** (`app/quiz/[id].tsx`) —
  Reading-д `passage_text` дээд талд, Listening-д `audio_url` тоглуулагч. Үр дүнд
  **band score (0–9)** + зөв тоо (`ieltsBand` серверээс).
- **W/S:** шинэ хөнгөн **практик дэлгэц** (`app/ielts/practice/[id].tsx` эсвэл түүнтэй
  адил): `open_response` prompt харуулна → хэрэглэгч бичнэ (Writing) / дуу бичнэ
  (Speaking, байгаа audio recorder) → **"Жишиг хариулт харах"** дарж modelAnswer +
  bandNote нээж өөрөө харьцуулна. **Submit/оноо байхгүй** (self-study).
  **MVP: W/S практикт XP олгохгүй** (farming-аас сэргийлэх; дараа нэмж болно).
- Бүх текст i18n (mn эхэнд), өнгө theme, API client дундуур (CODING_RULES).

## 6. Admin authoring

- **"IELTS" хэсэг** (шинэ page эсвэл байгаа Quiz/Дасгал page-д IELTS категори).
- Байгаа **`QuizQuestionsEditor` дахин ашиглана** + IELTS-ийн шинэ талбарууд:
  passage_text (Reading), audio upload (Listening), `open_response` editor
  (prompt / imageUrl / modelAnswer / bandNote) — W/S.
- Select/bulk/pagination байгаа component-уудыг дагана. `options.ts`-д
  `ieltsModuleOptions`.

## 7. Өгөгдөл / migration

- Migration: `AddIeltsQuizFields` → `passage_text` (text null), `audio_url` (varchar null).
- Шинэ enum утга шаардлагагүй (`category` нь чөлөөт varchar).
- `open_response` = jsonb доторх утга → schema migration шаардлагагүй.
- Prod: `DB_SYNCHRONIZE=false` тул migration гараар гүйцэнэ.

## 8. Нэгжүүд (isolation)

| Нэгж | Юу хийх | Хамаарал |
| --- | --- | --- |
| `ielts-band` helper (BE) | correct/total → band 0–9 | цэвэр функц, тесттэй болгож болно |
| Quiz `open_response` (BE) | шинэ асуултын төрөл validate/grade-skip | `quizzes.service` |
| `/ielts` hub (mobile) | 4 модуль → жагсаалт | `api/quizzes` (байгаа) |
| W/S практик дэлгэц (mobile) | prompt + model answer reveal | audio recorder (байгаа) |
| IELTS admin authoring | контент оруулах | `QuizQuestionsEditor` (байгаа) |

## 9. Шийдвэрлэсэн асуултууд

- Гүн: **бүтэн вертикал** (модуль практик → дараа mock).
- W/S: **практик + жишиг хариулт** (AI/багш дүгнэлтгүй).
- Байршил: **Home orц → `/ielts` hub** (5 дахь tab нэмэхгүй).
- Загвар: **Approach A** (Quiz дахин ашиглах), mock test Phase 2-т `IeltsTest` бүлэглэгч.

## 10. Нээлттэй (implementation-д тодруулах)

- Band conversion яг ямар хувь→band хүснэгт (практик секцэд ойролцоолол).
- Mobile owner (Choi эсвэл Boju) — shared `Home`/`_layout` тул зарлаж эхэлнэ.
