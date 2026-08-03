# AI Толь — 4 утгатай хайлтын үр дүн + тусдаа Толины сан

**Огноо:** 2026-08-03 · **Эзэн:** Өсөхбаяр (backend + admin), mobile хэсэг нь
shared/Choi-н файлд хүрдэг тул жижиг PR-аар · **Салбар:** `usukhbayar`

---

## 1. Асуудал

Хоёр тусдаа асуудлыг нэг ажлаар шийднэ.

**a) Хайлтын үр дүн хэтэрхий ядуу.** `GET /dictionary/:word` нь Gemini-гээс
"1–4 үгийн богино монгол утга" гуйгаад ганц мөр буцаадаг. Хэрэглэгч
search icon дээр дараад үг хайхад тухайн үгийн бодит амьдрал дээрх өөр өөр
хэрэглээ (`run` = гүйх / бизнес ажиллуулах / төхөөрөмж ажиллах / `run out of`)
огт харагддаггүй.

**b) Хайсан үг `words` банкийг бохирдуулж байна.** `POST /dictionary/:word/save`
нь тухайн үг `words`-д байхгүй бол `status = needs_review` -тэй шинэ `Word` мөр
үүсгэдэг. Үүний улмаас admin-ы **Үгс** хуудас нь редакцийн авторласан контент
биш, хэрэглэгчдийн хайсан үгийн хогийн сав болж байна.

## 2. Шийдэл (нэг өгүүлбэрээр)

Хайлтын урсгалыг тусдаа **`dictionary_entries`** сан руу салгаж, үг тус бүрд
хэрэглээний давтамжаар эрэмбэлсэн **хамгийн ихдээ 4 утга** хадгална. Хэрэглэгчийн
⭐ хадгалалт нь `words` биш **`user_dictionary_saves`** руу орно. Admin-д шинэ
**"Толь"** цэс нэмж, энэ санг харах/засах/устгах боломжтой болгоно.

## 3. Хамрах хүрээ (баталсан шийдвэрүүд)

| Асуулт | Шийдвэр |
|---|---|
| 4 утгатай формат хаана гарах? | **Зөвхөн search (толь) хайлт.** Унших материал дээр үг дээр давхар дарахад хуучин шиг богино 1 утга хэвээр. |
| Admin Толь юу харуулах? | **Cache байдлаар** — үг + утгууд + хэдэн удаа хайгдсан + сүүлд хайсан огноо. Хэн хайсныг бүртгэхгүй. |
| ⭐ хадгалсан үг хаашаа? | **Тольд үлдэнэ.** `words` банкинд огт мөр үүсэхгүй. |
| ⭐-г хаана хадгалах? | **Шинэ `user_dictionary_saves` хүснэгт.** Хадгалсан үгс дэлгэц 2 хэсэгтэй болно. |

**Хамрахгүй (YAGNI):** хэн юу хайсны хэрэглэгч тус бүрийн лог · Толь → Үгсийн
сан руу зөөх товч · унших дэлгэц дээрх 4 утга · утга тус бүрийн аудио ·
`edited` мөрийг AI-гаар дахин үүсгэх товч.

---

## 4. Өгөгдлийн загвар

### 4.1 Яагаад `translations`-ыг өргөтгөхгүй вэ

`translations` хүснэгт аль хэдийн гурван өөр зүйл хольж хадгалж байна:

1. үгийн богино монгол утга (`explain`),
2. **бүтэн өгүүлбэрийн орчуулга** — `translateSentence()` нь ≤200 тэмдэгттэй
   өгүүлбэрийг мөн `word` баганад түлхүүр болгон хийдэг,
3. **хоосон утгатай аудио stub** — `getAudio()` нь текст хайлтаас өмнө чанга
   яригч дарвал `translation: ''` -тэй мөр үүсгэдэг.

Тэнд `senses` багана нэмбэл admin-ы Толь хуудас нь өгүүлбэр, хоосон мөрөөр
дүүрэх бөгөөд шүүх heuristic бичих шаардлага гарна. Тиймээс **шинэ хүснэгт**.
`translations` хүснэгт энэ ажлаар **огт өөрчлөгдөхгүй** — унших дэлгэцийн
давхар дарах урсгал болон дуудлагын аудио байгаагаараа үлдэнэ (регресс тэг).

### 4.2 `dictionary_entries` (шинэ)

`BaseEntity`-г өвлөнө (`id` uuid PK · `created_at` · `updated_at`).

| Багана | Төрөл | Тайлбар |
|---|---|---|
| `word` | `varchar`, **unique index** | Жижиг үсэг, trim хийсэн хайлтын түлхүүр |
| `senses` | `jsonb`, NOT NULL | `[{ word, example, translation }]` — **1–4 ширхэг**, хэрэглээний давтамжаар эрэмбэлсэн |
| `search_count` | `int`, default 0 | Хэдэн удаа хайгдсан. **Cache hit дээр ч нэмэгдэнэ** |
| `last_searched_at` | `timestamptz`, nullable | Сүүлд хайсан цаг |
| `source` | `varchar`, nullable | Үүсгэсэн загвар, ж: `gemini-2.5-flash` |
| `edited` | `boolean`, default false | Admin гараар зассан эсэх |

`senses` элементийн бүтэц (TS interface `WordSense`):

```ts
{
  word: string;        // үг эсвэл холбоо үг, ж: "run", "run out of"
  example: string;     // англи жишээ өгүүлбэр
  translation: string; // тэр өгүүлбэрийн монгол орчуулга
}
```

Тайлбар, тодорхойлолт, "most common" гэх мэт шошго **байхгүй**.

### 4.3 `user_dictionary_saves` (шинэ)

| Багана | Тайлбар |
|---|---|
| `user_id` | `uuid`, FK → `users`, `onDelete: CASCADE`, `@JoinColumn({ name: 'user_id' })` |
| `word` | `varchar` — нормчилсон үг (FK биш) |
| — | `UNIQUE (user_id, word)` |

`word`-ыг `dictionary_entries` руу FK болгохгүй: унших дэлгэц дээр давхар дарж
хадгалсан үгэнд `dictionary_entries` мөр байхгүй (тэр урсгал зөвхөн
`translations`-д хүрдэг). Мөн admin Толины мөрийг устгахад хэрэглэгчийн
хадгалсан жагсаалт эвдрэхгүй.

Хадгалсан жагсаалтыг уншихдаа **snapshot хадгалахгүй** — үгсээр нь
`dictionary_entries` ба `translations`-ыг багцаар уншиж, мөрийн дэд бичвэрийг
дараах дарааллаар авна:

1. `translations.translation` — богино монгол утга (тухайн үгийг унших дэлгэц
   дээр давхар дарж байсан бол байна),
2. байхгүй бол `senses[0].translation` — эхний утгын **өгүүлбэрийн** орчуулга,
   нэг мөрд багтаан таслана,
3. хоёулаа байхгүй бол дэд бичвэргүй, зөвхөн үг.

Шинэ `senses` бүтцэд богино үгийн утга (gloss) байхгүй гэдгийг анхаарна уу —
тиймээс 2-р сонголт нь өгүүлбэр бөгөөд таслагдана. Snapshot хадгалахгүй тул
admin засвар шууд тусна (хуучирсан хуулбар үлдэхгүй).

### 4.4 Migration

Шинэ файл `backend/src/migrations/1786500000000-CreateDictionaryEntries.ts`
(хамгийн сүүлийн `1786400000000`-ийн дараа). Prod дээр `DB_SYNCHRONIZE=false`
тул энэ заавал хэрэгтэй; dev нь entity-ээс автоматаар үүснэ.

Хоёр `CREATE TABLE IF NOT EXISTS` + `word` дээр unique index +
`(user_id, word)` дээр unique index. `down()` нь хоёр хүснэгтийг устгана.

---

## 5. Backend

### 5.1 Endpoint-ууд

| Endpoint | Эрх | Тайлбар |
|---|---|---|
| `GET /dictionary/search/:word` | JWT | **Шинэ.** `dictionary_entries` → байхгүй бол Gemini → хадгална. Буцаах: `{ word, senses: WordSense[], cached: boolean }` |
| `GET /dictionary/saves` | JWT | **Шинэ.** Хэрэглэгчийн ⭐ жагсаалт: `{ word, senses, translation }[]` |
| `POST /dictionary/saves/:word` | JWT | **Шинэ.** ⭐ toggle → `{ word, saved: boolean }` |
| `GET /dictionary/admin/entries` | JWT + `admin`/`super_admin`/`moderator` | **Шинэ.** `?search=&page=&limit=&sort=` → `{ items, total }` |
| `PATCH /dictionary/admin/entries/:id` | адил | **Шинэ.** `senses`-ыг солино, `edited = true` |
| `DELETE /dictionary/admin/entries/:id` | адил | **Шинэ.** Мөр устгана |
| `POST /dictionary/:word/save` | — | **УСТГАНА.** Энэ л `words`-д `needs_review` мөр үүсгэдэг байсан |
| `GET /dictionary/:word` · `POST /dictionary/translate` · `GET /dictionary/:word/audio` | JWT | **Өөрчлөгдөхгүй** |

⚠️ **Route дараалал:** одоогийн `@Get(':word')` нь `/dictionary/saves`-ыг
залгична. Шинэ тодорхой route-уудыг controller дотор `@Get(':word')`-оос
**дээр** бичих ёстой. (`/dictionary/search/:word` ба `/dictionary/admin/...`
хоёр сегменттэй тул мөргөлдөхгүй, гэхдээ бүгдийг дээр нь тавьсан нь ойлгомжтой.)

Admin route-ууд нь одоо байгаа `@Roles()` + `RolesGuard` хослолыг ашиглана.

### 5.2 `searchSenses()` логик

```
1. word = normalise(input)                     // trim + lowercase
2. entry = dictionary_entries.findOne({ word })
   → олдвол: search_count += 1, last_searched_at = now()
             return { word, senses: entry.senses, cached: true }
3. plan хязгаар шалгах (одоогийн explain()-тай ижил:
   user.plan.dictionaryAiLimit vs user.dictionaryAiCount → ForbiddenException,
   мессеж хэвээр: "Сарын толь бичгийн хязгаар хэтэрлээ (…)")
4. Gemini дуудна (§5.3)
5. senses урт 0 бол → NotFoundException, ЮУ Ч ХАДГАЛАХГҮЙ
6. dictionary_entries-д хадгална (search_count = 1, last_searched_at = now(),
   source = model). Unique мөргөлдвөл (зэрэг хайлт) → дахин уншаад буцаана.
7. AiUsage лог: type = TEXT_CHAT, metadata.feature = 'dictionary_senses'
8. users.increment(dictionaryAiCount, 1)
9. return { word, senses, cached: false }
```

**`words` банкийг энд шалгахгүй.** Тэнд ганц утга (`mongolian` + нэг жишээ)
байдаг тул 4 утга гаргаж чадахгүй. Хайлтын cache = зөвхөн `dictionary_entries`.
(Унших дэлгэцийн `explain()` нь урьдын адил `words` → `translations` → Gemini
дарааллаа хэвээр хадгална.)

`search_count`-ыг **cache hit дээр ч** нэмэхгүй бол Толь хуудасны "хамгийн их
хайгдсан" эрэмбэ утгагүй болно — 2-р алхам эрт `return` хийхээсээ өмнө заавал
нэмнэ.

### 5.3 Gemini дуудлага

Одоо байгаа `runGemini()` helper-ийг ашиглана (429/503 retry, token тоолол нь
бэлэн), гэхдээ **JSON горим**-той дуудах шаардлагатай тул түүнд заавал байх
өөрчлөлт: `generationConfig`-т `responseMimeType: 'application/json'` +
`responseSchema` дамжуулах боломж (нэмэлт заавал бус параметр — одоогийн
дуудагчид өөрчлөгдөхгүй).

Prompt (монголоор, тодорхой):

- `"<word>"` англи үгийн бодит амьдралд **хамгийн түгээмэл хэрэглэгддэг**
  утгуудыг хэрэглээний давтамжаар эрэмбэлж, **хамгийн ихдээ 4** ширхэгийг
  буцаа.
- Утга тус бүрд: `word` (үг эсвэл холбоо үг), `example` (богино англи жишээ
  өгүүлбэр), `translation` (тэр өгүүлбэрийн монгол орчуулга).
- Тайлбар, тодорхойлолт, шошго, дугаарлалт бүү нэм.
- Түгээмэл биш ховор утга байвал 4-ээс цөөн буцаа — хиймэл дүүргэлт хийхгүй.

Хариу задлах хамгаалалт (**зөвхөн prompt-д найдахгүй**):

1. ` ```json … ``` ` хашилтыг цэвэрлэх,
2. `JSON.parse` — амжилтгүй бол `senses = []`,
3. массив мөн эсэхийг шалгах,
4. элемент бүрийн 3 талбар string бөгөөд хоосон биш эсэхийг шалгаж шүүх,
5. `.slice(0, 4)`.

Энэ задлагч нь **цэвэр функц** (`parseSenses(raw: string): WordSense[]`) байх
ёстой — unit тест хийхэд амархан.

### 5.4 Хүрэх файлууд

```
backend/src/entities/dictionary-entry.entity.ts        (шинэ)
backend/src/entities/user-dictionary-save.entity.ts    (шинэ)
backend/src/entities/index.ts                          (entities массивт нэмэх)
backend/src/dictionary/dictionary.controller.ts        (route-ууд)
backend/src/dictionary/dictionary.service.ts           (searchSenses, saves, admin CRUD)
backend/src/dictionary/dto/update-senses.dto.ts        (шинэ, class-validator)
backend/src/dictionary/dictionary.module.ts            (шинэ repo-ууд)
backend/src/migrations/1786500000000-CreateDictionaryEntries.ts (шинэ)
API.md                                                 (§11 шинэчлэх)
```

`dictionary.service.ts` одоо 378 мөр. Шинэ логик нэмэгдэхэд 600+ мөр болно —
тиймээс **хайлт/хадгалалт/admin CRUD-ыг `dictionary-senses.service.ts` гэсэн
тусдаа service-д** бичиж, `DictionaryService`-ыг одоогийн gloss/өгүүлбэр/аудио
үүрэгтээ үлдээнэ. `runGemini` нь хоёулангийнх нь хэрэглэдэг helper болох тул
`gemini-text.ts` файл руу гаргана.

---

## 6. Mobile

### 6.1 Хайлтын үр дүнгийн карт (шинэ)

Одоогийн `runSearch()` нь `lookup()`-ыг дуудаад дарсан үгийн дээр наалддаг
260px өргөнтэй popover нээдэг (`sections` -ийн `maxHeight` 220). 4 утга × 3 мөр
тэнд багтахгүй, тиймээс хайлтын зам ба давхар дарах зам **сална**.

```
┌────────────────────────────────┐
│  run                  🔊   ⭐  │
├────────────────────────────────┤
│  1. run                        │
│     I run every morning.       │
│     Би өглөө бүр гүйдэг.       │
│                                │
│  2. run                        │
│     She runs a small business. │
│     Тэр жижиг бизнес ажиллуулдаг│
│                                │
│  3. run                        │
│     The machine is running.    │
│     Төхөөрөмж ажиллаж байна.   │
│                                │
│  4. run out of                 │
│     We ran out of food.        │
│     Бидний хоол дууссан.       │
└────────────────────────────────┘
```

- Дэлгэцийн голд байрлана, өргөн `screen − 2×spacing.lg`, дээд өндөр ~65%,
  доторлон гүйдэг. Бүдгэрсэн backdrop дээр дарвал хаагдана.
- Гарчиг, шошго, тодорхойлолт **байхгүй** — зөвхөн үг / англи жишээ / монгол
  орчуулга.
- 🔊 нь толгой үгэнд, одоо байгаа `GET /dictionary/:word/audio`-г хэвээр
  ашиглана (ElevenLabs → төхөөрөмжийн TTS fallback хэвээр).
- ⭐ нь `POST /dictionary/saves/:word`.
- Сүүлд хайсан үгс (AsyncStorage `dictionary_recents`) хэвээр.
- Ачаалж байх үед spinner, алдаанд "Олдсонгүй".

### 6.2 Унших дэлгэцийн давхар дарах popover

Хэлбэр, хэмжээ, урсгал нь **өөрчлөгдөхгүй**. Ганц өөрчлөлт: ⭐ товч нь
`POST /dictionary/:word/save`-ын оронд `POST /dictionary/saves/:word` дуудна.
Ингэснээр аппын аль ч замаар `words` банкинд мөр үүсэхээ болино.

### 6.3 Хадгалсан үгс дэлгэц (`saved.tsx`)

Хоёр хэсэгтэй болно:

- **Хичээлийн үгс** — одоогийн `GET /reviews/saved` (`LearnWord[]`). Flashcard
  дасгал (`SavedFlashcards`), зураг, түвшин зэрэг **зөвхөн энэ хэсэгт** үлдэнэ.
- **Тольны үгс** — шинэ `GET /dictionary/saves`. Мөр дарвал §6.1 карт нээгдэнэ;
  ⭐ дарвал хасагдана. Flashcard дасгалд ороогүй (зураг/түвшин/SM-2 төлөв
  байхгүй тул).

Аль нэг хэсэг хоосон бол тэр хэсгийн гарчиг харагдахгүй.

### 6.4 Хүрэх файлууд

```
mobile/src/api/dictionary.ts          WordSense + searchWord/getDictionarySaves/
                                      toggleDictionarySave нэмэх;
                                      ашиглагдаагүй DictionarySection/sections устгах;
                                      saveWord() устгах
mobile/src/components/DictionaryProvider.tsx   хайлтын карт (шинэ render зам),
                                      :406 дэх sections блокыг солих,
                                      ⭐ шинэ endpoint рүү
mobile/app/saved.tsx                  2 хэсэг
mobile/src/i18n/index.ts              шинэ мөрүүд
```

`mobile/src/api/dictionary.ts`-д одоо `DictionarySection = { title, body }`
гэсэн ашиглагдаагүй төрөл байгаа. Энэ нь **шинэ форматтай таарахгүй** (гарчиг,
тайлбартай) — түүнийг дахин ашиглах гэж оролдохгүй, устгана.

⚠️ `DictionaryProvider.tsx` нь shared `mobile/src/components/`, `saved.tsx` нь
Choi-н бүсэд байгаа тул CLAUDE.md-ийн дагуу **CLAUDE.md-д зарлаад жижиг PR**-аар
оруулна.

---

## 7. Admin

- `Sidebar.tsx`-д `{ to: '/dictionary', label: 'Толь', icon: BookMarked }` —
  **Үгс**-ийн шууд доор.
- `access.ts` → `MODERATOR_PATHS`-д `/dictionary` нэмнэ (контентын хуудас).
- `App.tsx`-д lazy route `/dictionary` → `admin/src/pages/dictionary/DictionaryPage.tsx`.

Хүснэгт:

| Үг | Утга | Хайлт | Сүүлд | Эх | Үйлдэл |
|---|---|---|---|---|---|
| run | 4 | 127 | 08-03 | gemini | Засах · Устгах |
| get along | 3 | 12 | 08-01 | ✏️ зассан | Засах · Устгах |

- Хайх талбар (debounce), эрэмбэ: **хайлтаар (default)** / шинэ.
- Одоо байгаа `<Pagination>` компонентыг дахин ашиглана (limit 50).
- Засах цонх: 1–4 мөр, мөр тус бүр `үг / англи жишээ / монгол орчуулга`.
  Хадгалахад `PATCH` → `edited = true`. Хоосон мөрийг хадгалахгүй.
- Устгахад баталгаажуулалт. Устгасан үгийг дараагийн хайлтад AI дахин үүсгэнэ —
  үүнийг цонхонд бичиж анхааруулна.

---

## 8. Ирмэгийн тохиолдол

| Тохиолдол | Хандлага |
|---|---|
| Gemini буруу JSON эсвэл 0 утга | "Олдсонгүй" алдаа. **Cache-д хадгалахгүй** — хоосон мөр үүрд үлдэхээс сэргийлнэ |
| 4-өөс цөөн утга (ж: `abandon` → 2) | Байгаагаар нь. Хиймэл дүүргэлт хийхгүй |
| Монгол / утгагүй оролт | AI хоосон буцаана → "Олдсонгүй" |
| Хоёр хэрэглэгч зэрэг ижил үг хайх | Unique index мөргөлдвөл алдаа шидэхгүй, дахин уншаад буцаана |
| Планы хязгаар хэтэрсэн | Одоогийн `ForbiddenException` мессеж хэвээр |
| Admin зассан мөр | Дахин AI дуудахгүй (одоо ч дуудахгүй). Ирээдүйд "дахин үүсгэх" товч нэмбэл `edited`-ыг хүндэтгэнэ |
| `words`-д өмнө үүссэн `needs_review` мөрүүд | **Хөндөхгүй.** Гарал үүслийг ялгах тэмдэг байхгүй тул цэвэрлэх migration бичихгүй. Шинээр үүсэхээ л болино |
| Хэрэглэгч устгагдвал | `user_dictionary_saves` нь `onDelete: CASCADE` |

---

## 9. Тест

- **Unit:** `parseSenses()` — ` ``` ` хашилттай хариу, буруу JSON, 6 элемент
  (→ 4 болж таслагдана), дутуу талбартай элемент (→ шүүгдэнэ), хоосон массив.
- **e2e:**
  - Cache hit нь `search_count`-ыг нэмдэг эсэх (AI дуудалгүйгээр),
  - ⭐ toggle → `GET /dictionary/saves` дээр гарч ирж, дахин дарахад алга болох,
  - ⭐ дарсны дараа `words` хүснэгтэд **шинэ мөр үүсээгүй** эсэх,
  - admin бус хэрэглэгч `/dictionary/admin/entries` рүү орох боломжгүй.
- **Гараар:** Expo Go дээр хайлтын карт, унших дэлгэцийн popover хэвээрээ
  эсэх, Хадгалсан үгс 2 хэсэг.

## 10. Хэрэгжүүлэх дараалал

1. Entity ×2 + `entities/index.ts` + migration
2. `gemini-text.ts` гаргаж авах + `parseSenses` + unit тест
3. `dictionary-senses.service.ts` — search / saves / admin CRUD
4. Controller route-ууд (дараалалд болгоомжтой) + DTO + хуучин
   `POST /:word/save` устгах
5. `API.md` §11 шинэчлэх
6. Admin: api + хуудас + sidebar + route + access
7. Mobile: api → DictionaryProvider → saved.tsx → i18n
8. `CLAUDE.md`-д shared өөрчлөлтийг зарлах (Choi/Boju-д)
