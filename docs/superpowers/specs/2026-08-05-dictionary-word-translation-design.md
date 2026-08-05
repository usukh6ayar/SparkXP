# Толь: үгийн өөрийнх нь орчуулгыг харуулах

**Огноо:** 2026-08-05 · **Эзэн:** Өсөхбаяр (backend + admin) · **Хамрах хүрээ:** backend · admin · mobile

## Асуудал

Толь дээр үг хайхад **зөвхөн 4 жишээ өгүүлбэр + тэдгээрийн орчуулга** гарч байна.
Хайсан үгийн өөрийнх нь монгол утга хаана ч харагдахгүй.

Шалтгаан: `mobile/src/components/dictionary/useWordLookup.ts:101` — `detailed`
горимд зөвхөн `searchWord()` дуудаж, `translation`-г **`''` гэж хатуу** тавьдаг.
`GET /dictionary/search/:word` нь `{ word, senses, cached }` буцаадаг тул үгийн
утга гэж буцаах юм байхгүй. (`WordSense.translation` нь *жишээ өгүүлбэрийн*
орчуулга — үгийн утга биш.)

## Шийдэл

`GET /dictionary/search/:word` хариунд **`translation`** нэмнэ — үгийн 1–3
хамгийн түгээмэл утгыг `;`-ээр тусгаарласан нэг мөр (ж: `гүйх; ажиллуулах; урсах`).
Утгыг **`dictionary_entries`-д хадгална** — senses-ийн адил нэг удаа үүсээд
үүрд cache-лэгдэнэ, нэмэлт AI дуудлага үүсэхгүй.

Харагдац (хэрэглэгчийн сонгосон): гарчгийн доор **нэг мөр**, доор нь 4 утга
одоогийнхоороо.

```
run                          [🔊] [⭐]
гүйх; ажиллуулах; урсах        ← ШИНЭ
──────────────────────────────
1.  run
    I run every morning.  🔊
    Би өглөө бүр гүйдэг.
```

## Өөрчлөлт

### 1. Дата — `dictionary_entries.translation`

`varchar(200) NULL`. Migration зөвхөн багана нэмнэ (`AddDictionaryEntryTranslation`).

> ⚠️ Нэр давхцахаас сэргийлэх: `DictionaryEntry.translation` = **үгийн** утга.
> `WordSense.translation` = тухайн **жишээ өгүүлбэрийн** орчуулга. Хоёул хэвээр
> үлдэнэ; entity дээр тайлбар бичнэ.

### 2. AI — нэг дуудлагаар хоёулаа

`sensesPrompt` + `SENSES_SCHEMA` нь массивын оронд **объект** буцаана:

```json
{ "translation": "гүйх; ажиллуулах; урсах",
  "senses": [ { "word": "...", "example": "...", "translation": "..." } ] }
```

`parseSenses` → `parseEntry(raw): { translation: string | null; senses: WordSense[] }`.
Хуучин хэлбэрүүд (бараа массив, `{ senses: [...] }`) хэвээр ажиллана —
тэр үед `translation: null`. `translation` нь `WORD_TRANSLATION_MAX = 200`
тэмдэгтээс урт бол **хаяна** (senses-ийн адил: хагас баталгаажсаныг үүрд
хадгалахаас хоосон нь дээр). `senses` хоосон бол өмнөх дүрмээр 404, юу ч
cache-лэхгүй.

### 3. Хуучин мөрүүд (`translation IS NULL`)

Дахин AI үүсгэхгүй. Cache hit дээр `translation` хоосон бол одоо байгаа
**богино-gloss** зам (`DictionaryService` → `words` банк → `translations` cache →
Gemini) -аас нэг удаа авч мөрд нь бичнэ. Ихэнхдээ `translations` cache-ийн
уншилт болно. Өөрөө өөрийгөө эдгээх тул bulk regenerate шаардлагагүй.

Энэ нөхөлт **алдвал хайлт унахгүй** — `translation: null` буцааж, апп мөрийг
харуулахгүй.

### 4. API

```
GET /dictionary/search/:word → { word, translation: string | null, senses, cached }
```

`PATCH /dictionary/admin/:id` нь `senses`-ийн хажууд `translation`-ийг хүлээж
авна (`edited = true`).

### 5. Mobile

- `searchWord()` хариунд `translation` нэмэгдэнэ.
- `useWordLookup` — `translation: ''` хатуу утгыг хариунаас ирсэн утгаар солино.
  Уншигчийн popover зам (`detailed` биш) **хөндөгдөхгүй**.
- `DictionaryPanel` — гарчгийн доор нэг мөр (утга байхгүй бол мөр огт гарахгүй).
- "Хадгалсан үгс"-ийн дэд гарчиг эрэмбэ: богино gloss → **`entry.translation`** →
  эхний sense-ийн өгүүлбэрийн орчуулга (одоо шууд 3 дахь руу үсэрдэг).

### 6. Admin "Толь"

Мөр бүрт `translation` баганаа харуулж, засах цонхонд текст талбар нэмнэ.

## Тест

`senses.spec.ts`-д `parseEntry`-ийн тохиолдлууд: объект хэлбэр · бараа массив
(хуучин) · `translation` хэт урт → null · `translation` байхгүй → null ·
senses хоосон → `[]`.

## Гадуур үлдээх (YAGNI)

- Утга бүрт тусад нь монгол гloss (хэрэглэгч дээд талын нэг мөрийг сонгосон).
- Байгаа мөрүүдийг bulk regenerate хийх.
- Уншигчийн popover-ын харагдацыг өөрчлөх.
