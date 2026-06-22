# Vocabulary System — Bulk Content + Review + Swipe (Design Doc)

> **Зорилго:** 20,000+ vocabulary card-ыг **гараар биш**, bulk upload →
> auto-validate → media auto-match → admin review → publish → swipe гэсэн
> **pipeline**-аар удирдах. Энэ баримт нь хэрэгжүүлэлтийн **shared brain** —
> хоёр dev (Usukhbayar/mobile, Bishrelt/admin) үүнийг дагана.
>
> Холбоотой: `CLAUDE.md` (дүрэм) · `API.md` (endpoint) · `ROLES.md` (эрх) ·
> `MOBILE_ROADMAP.md` (swipe). Сүүлд: **2026-06-22**.

---

## 0. Pipeline (нэг дор)

```
Admin bulk upload (CSV/JSON/Excel + медиа ZIP)
   ↓ server-side parse + validate
   ↓ media-г slug-аар авто холбоно (abandon.mp3 → "abandon")
   ↓ алдаа/дутууг report болгож буцаана (admin татаж засна)
Words DB-д status=needs_review-ээр орно
   ↓ admin filter/bulk-edit → approve → publish
status=published үгс л student апп-д гарна (swipe)
   ↓ хэрэглэгч swipe (forgot/know) + save (star) + audio
WordReview-д per-user progress хадгална
   ↓ admin learning analytics-аар хянана
```

**Гол зарчим (CLAUDE.md):** контент DB-д, медиа CDN URL, UUID PK,
`status`-аар gating, per-user progress нь card дээр БИШ — `word_reviews`-д.

---

## 1. Data Model

### 1.1 `Word` entity — нэмэх талбарууд

Одоо байгаа: `english, mongolian, partOfSpeech, exampleSentence,
exampleTranslation, audioUrl, imageUrl, level, lessonId`.

**Нэмэх:**

| Талбар (TS / DB) | Төрөл | Тайлбар |
|---|---|---|
| `status` / `status` | `WordStatus` enum | draft·needs_review·approved·rejected·published. **DB default = `published`** (одоо байгаа 500 үг харагдсаар байхын тулд). Import-аар орсон шинэ үг → `needs_review`. |
| `englishDefinition` / `english_definition` | text null | Англи тодорхойлолт ("to leave … behind"). `mongolian` = монгол утга ("Орхих, хаях") хэвээр. |
| `phonetic` / `phonetic` | varchar null | /əˈbændən/ |
| `category` / `category` | varchar null | Daily Life·Business·Law·Medical·Engineering… **Нээлттэй string** + `VOCAB_CATEGORY_SUGGESTIONS` const (Organization.type-ийн загвар — DRY, app-update-гүй нэмнэ). category_id lookup table нь **дараагийн** сонголт. |
| `slug` / `slug` | varchar, **indexed** | `english`-ээс авто (lowercase, trim, зай→`_`). Медиа filename match-д. Unique БИШ (homonym). |

> `WordStatus` enum-г `common/enums/index.ts`-д нэмнэ. `ContentLevel` хэвээр.

### 1.2 `WordReview` entity — per-user progress нэмэх

Одоо: SM-2 (`easeFactor, intervalDays, repetitions, nextReviewAt, lastReviewedAt`).
**Шинэ entity үүсгэхгүй** — энэ нь аль хэдийн (user, word) хос. Нэмэх:

| Талбар | Төрөл | Тайлбар |
|---|---|---|
| `saved` / `saved` | bool default false | ⭐ star — хадгалсан эсэх |
| `recallStatus` / `recall_status` | `RecallStatus` enum null | forgot·learning·know |
| `reviewCount` / `review_count` | int default 0 | нийт харсан |
| `correctCount` / `correct_count` | int default 0 | know дарсан |
| `wrongCount` / `wrong_count` | int default 0 | forgot дарсан |
| `lastSeenAt` / `last_seen_at` | timestamptz null | сүүлд харсан |

> Difficulty signal = `wrongCount / (wrongCount + correctCount)`.

### 1.3 Migration / rollout

- Dev: `DB_SYNCHRONIZE=true` багануудыг авто нэмнэ.
- `status` default `published` → одоогийн 500 үг алга болохгүй.
- Шинэ import → `needs_review` (доороос ил тод set хийнэ).
- `slug`-ийг одоо байгаа үгсэд нэг удаагийн backfill script-ээр бөглөнө
  (`backend/src/scripts/`).

---

## 2. Status workflow

```
draft ──▶ needs_review ──▶ approved ──▶ published
                  └──▶ rejected (буцаах боломжтой)
```

- **Хэн:** moderator/admin/super_admin (контент эрх — ROLES.md).
- App-д **зөвхөн `published`**. Бусад status зөвхөн admin-д харагдана.
- `PATCH /words/:id` дотор `status` солих эсвэл доорх bulk endpoint.

---

## 3. Bulk upload (Phase 2)

### 3.1 Endpoints (шинэ)

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/words/import` | 🛡️mod | Multipart: `file` (CSV/JSON, дараа Excel). Parse+validate+insert → **report** буцаана. Шинэ мөр `status=needs_review`. |
| POST | `/words/media/import` | 🛡️mod | Multipart: `archive` (ZIP зураг/audio). Файл бүрийг `slug`-аар word-д холбоно. |
| GET | `/words/import/template` | 🛡️mod | CSV загвар татах |

> Одоогийн `POST /words/bulk` (JSON массив) хэвээр үлдэнэ (legacy / жижиг).

### 3.2 CSV формат (нэг мөр = нэг card)

```
word,part_of_speech,level,category,english_definition,mongolian_meaning,english_example,mongolian_example,phonetic,image_url,audio_url
abandon,verb,A1,Daily Life,to leave behind,"Орхих, хаях",He abandoned the old house.,Тэр хуучин байшинг орхисон.,/əˈbændən/,,
```

### 3.3 Validation дүрэм

`word` хоосон · `mongolian_meaning` хоосон · `level` буруу enum ·
`english_definition` хэт урт (>200) · duplicate (`slug`+`level` давхцал) ·
дэмжээгүй медиа формат (зөвхөн jpg/png/webp, mp3/m4a/wav).

### 3.4 Report shape

```ts
{
  total: number; inserted: number; updated: number; skipped: number;
  errors:   { row: number; field: string; message: string }[];
  duplicates:    { row: number; word: string }[];
  missingImage:  string[];  // slug-ууд
  missingAudio:  string[];
}
```
Admin error-уудыг CSV болгож татаж аваад засна.

### 3.5 Media auto-match

ZIP задлаад файл бүр (`abandon.mp3`) → ext хасаад slug `abandon` →
тухайн word олвол storage-д upload хийгээд `audioUrl`/`imageUrl` set.
Олдоогүй файл report-д `unmatched`. Audio байхгүй үг → `audio_url=empty`.
Pronunciation button зөвхөн **word**-ийн audio (def/example-д audio алга).

---

## 4. Admin dashboard (Phase 3)

### 4.1 Monitor counts — `GET /words/stats`

```ts
{ total, byStatus:{draft,needs_review,approved,rejected,published},
  missingImage, missingAudio, missingMnExample, duplicates }
```

### 4.2 Filter (`GET /words` query өргөтгөх)

`status, level, category, hasImage, hasAudio, hasMnExample, duplicates,
search` — жишээ: "B1 verb image-гүй", "Medical missing audio".

### 4.3 Bulk edit — `PATCH /words/bulk`

`{ ids: string[], changes: { status?, category?, level? } }` —
олон үгийг нэг дор approve/publish/категорьжуулна.

### 4.4 Review queue UI

`needs_review` жагсаалт → мөр бүр засах/approve/reject → publish.
Filter + bulk-select + "approve selected" + "publish selected".

---

## 5. Mobile swipe (Phase 4 — Usukhbayar)

Mockup карт (zurag.jpg): level badge · ⭐ save · зураг · category · POS ·
**Word** · phonetic · 🔊 audio · english def · 🇲🇳 meaning · Example (en+mn) ·
**Forgot / Know** swipe.

- **Queue:** `GET /reviews/learn` (одоо байгаа) → зөвхөн `published`, per-user
  progress merge, шинэ талбарууд (def/phonetic/category/image/audio).
- **Swipe right (Know):** `recallStatus=know`, `correctCount++`, `lastSeenAt`.
- **Swipe left (Forgot):** `recallStatus=forgot`, `wrongCount++`, deck-ийн ард.
- **⭐ Save toggle:** `POST /reviews/:wordId/save` → `saved` урвуулна.
- **🔊 Audio:** `expo-av`-аар `audioUrl` тоглуулна (зөвхөн word).
- Saved үгсийн дэлгэц (Profile-оос) — дараа.

---

## 6. Learning analytics (Phase 5 — admin)

`GET /words/analytics` (admin): хамгийн их forgotten/saved/known үгс,
difficulty signal (`wrong/(wrong+correct)`), category usage, avg save rate.
Жишээ: `abandon — seen 12,400 · forgot 38% · saved 9%`.

---

## 7. Phasing + ownership

| Phase | Агуулга | Эзэн | Давхарга |
|---|---|---|---|
| **1** | Entity өргөтгөл (Word status/category/phonetic/def/slug, WordReview progress) + published gating + slug backfill | shared | backend |
| **2** | Bulk upload v2 (import/media/template endpoint, validate, report, auto-match) | Bishrelt | backend+admin |
| **3** | Admin monitor/filter/bulk-edit/review queue | Bishrelt | admin |
| **4** | Mobile swipe redesign + per-user progress + audio + save | Usukhbayar | mobile |
| **5** | Learning analytics | Bishrelt | backend+admin |

**Coordination:** Phase 1 нь бусдын суурь — эхэлж merge хийнэ. Backend
shared тул `API.md` + энэ docs-ыг шинэчилж, нөгөө dev-д мэдэгдэнэ.

---

## 8. Шийдвэрүүд (decisions, неэлттэй биш)

- **Category = string + suggestions** (lookup table биш) — MVP, app-update-гүй,
  Organization.type-ийн загвар. Scale дээр lookup руу шилжүүлж болно.
- **WordReview-г өргөтгөнө** (шинэ UserWordProgress entity үүсгэхгүй) — DRY.
- **status default = published** — одоогийн контент эвдрэхгүй; import → needs_review.
- **slug unique БИШ** — homonym/давхар үг блоклохгүй; media match best-effort.
- **Server-side import** (client-side CSV parse биш) — 20k мөр + Excel + ZIP.
