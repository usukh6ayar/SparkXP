# Cloudinary → Cloudflare (R2) migration plan

> Зорилго: медиаг Cloudinary-аас **Cloudflare R2** (egress үнэгүй, хямд) руу
> **фазаар, зөрчилгүй, rollback-тэй** зөөх. GLB аль хэдийн R2-д (PR #107).
> Огноо: 2026-07-08 · Эзэн: Өсөхбаяр (backend/admin).

---

## 0. TL;DR — 3 фаз

| Фаз | Медиа | Төлөв | Эрсдэл |
| --- | --- | --- | --- |
| 1 | **GLB (3D avatar)** | ✅ **Хийсэн** (R2) | — |
| 2 | **Аудио** (word / reading / idiom / buddy TTS) | ⬜ Хийх (дараагийн) | Бага — transform хэрэггүй |
| 3 | **Зураг** (word / idiom) | ⬜ Хамгийн сүүлд | Дунд — `f_auto/q_auto` optimize-г орлуулна |

**Зарчим:** шинэ медиаг R2 руу route хийж → байгааг backfill хийнэ. Cloudinary-г
migration дуустал **үлдээнэ** (хуучин URL ажилласаар байх = rollback аюулгүй).

---

## 1. Одоогийн байдал — медиа хаана хадгалагддаг

**Storage seam:** `backend/src/ai-gateway/image-storage.service.ts` → `storeMedia()`.
Одоо: `resourceType: 'model'` → **R2**; бусад (`image`/`video`) → **Cloudinary**; env
байхгүй бол локал `uploads/`.

**Call site-ууд:**
| Файл:мөр | Медиа | resourceType | Folder |
| --- | --- | --- | --- |
| `ai-gateway.service.ts:456` | Зураг (word/idiom base) | image | englishxp/generated |
| `ai-gateway.service.ts:817` (`storeWordImageBase64`) | Batch word зураг | image | englishxp/words |
| `words.service.ts:792` | → дээрхийг дууддаг | — | — |
| `ai-gateway.service.ts:500` | **Аудио** | video | englishxp/audio |
| `ai-gateway.service.ts:545` | **Аудио** | video | englishxp/audio |
| `buddy.service.ts:422` | **Buddy TTS аудио** | video | englishxp/ai-buddy |
| `upload.controller.ts:92` | Admin upload | image/video/model | englishxp/uploads · models |

**DB-д хадгалагдсан URL багана (backfill-д хамрагдана):**
- `words.image_url`, `words.audio_url`
- `idioms.image_url`, `idioms.audio_url`
- `reading_passages` cover + өгүүлбэрийн аудио (jsonb `sentences[].audioUrl`)
- `buddy_voice_cache.audio_url` · `messages.audio_url`
- `ai_buddies.avatar_asset_url` (✅ R2), `avatar_thumb_url`

---

## 2. Фаз 2 — Аудио → R2

### 2a. Шинэ аудиог R2 руу route (код)
1. `image-storage.service.ts`: `resourceType`-д **`'audio'`** нэмж, `storeMedia`-д
   `resourceType==='audio' && hasR2Config → uploadToR2` (Content-Type `audio/mpeg`,
   folder `englishxp/audio`). GLB-тэй ижил pattern.
2. 3 call site-ыг `'video'` → `'audio'` болгох:
   `ai-gateway.service.ts:505`, `:550`, `buddy.service.ts:426`.
3. Env: `R2_*` (аль хэдийн байгаа). Folder-уудыг R2 доор зохион байгуул
   (`buddy/`, `audio/words/` г.м.).

> Эрсдэл бага: аудио transform хэрэггүй, mobile зүгээр URL-аар тоглуулна (RN
> `fetch`/`expo-audio` public R2 URL-ыг шууд тоглуулна, CORS асуудалгүй).

### 2b. Байгаа аудиог backfill (script)
`backend/src/scripts/backfill-media-to-r2.ts` (шинэ, нэг удаагийн):
```
for each table+column with a Cloudinary audio URL:
  if url includes 'res.cloudinary.com' (эсвэл audioUrl байгаа):
    download bytes (fetch)
    upload to R2 (storeMedia resourceType:'audio', stable key)
    UPDATE row SET <col> = <new R2 url>
  идэмпотент: R2 URL аль хэдийн бол алгас
```
- Багцаар (batch), алдааг log-лож үргэлжлүүл (нэг unit алдаа бусдыг зогсоохгүй).
- Reading passages-ийн jsonb `sentences[]` доторх audioUrl-ыг мөн шинэчил.
- Эхлээд **staging/dev** дээр, дараа prod дээр `pg_dump` backup-тай.

---

## 3. Фаз 3 — Зураг → R2 + Cloudflare Image Transformations

⚠️ Хамгийн болгоомжтой хэсэг — Cloudinary-гийн **`f_auto/q_auto/dpr_auto/w_`**
(mobile `src/lib/image.ts`, `AppImage.tsx`) device-optimize-г орлуулах ёстой.

1. **Cloudflare Image Transformations** асаах (R2-г custom domain-д холбож
   `/cdn-cgi/image/width=…,quality=auto,format=auto/<r2-url>` хэлбэрээр optimize).
2. **mobile `src/lib/image.ts` дахин бичих:** Cloudinary transform URL үүсгэдэг
   логикийг **Cloudflare `/cdn-cgi/image/`** формат руу солих (device width/DPR →
   `width`, `format=auto`, `quality=auto`).
3. Backend зураг call site-уудыг R2 руу route (`resourceType:'image'` → R2 салаа).
4. Backfill: `words.image_url` + `idioms.image_url` (2а-тай ижил script, зураг).
5. Тест: mobile дээр зураг хэмжээ/чанар/хурд Cloudinary-тэй адил эсэхийг батал.

> Хэрэв Image Transformations хэт төвөгтэй бол: зургийг **Cloudinary дээр
> үлдээх** (hybrid) нь бүрэн зөв сонголт — optimize аль хэдийн ажиллаж байгаа.

---

## 4. Backfill script — ерөнхий загвар

- Нэг script, `--table` / `--dry-run` флагтай.
- Идемпотент: аль хэдийн R2 (`R2_PUBLIC_BASE_URL` агуулсан) URL-ыг алгасна.
- Тогтвортой key (slug/hash) → дахин ажиллуулахад давхардуулахгүй.
- Progress + алдааны тайлан хэвлэнэ.
- Ажиллуулах: `ts-node src/scripts/backfill-media-to-r2.ts --table words --dry-run`
  → шалгаад `--dry-run`-гүйгээр.

---

## 5. Rollback / аюулгүй байдал

- **Cloudinary-г устгахгүй** migration дуустал — хуучин URL ажилласаар (dual).
- Backfill бүр `pg_dump` backup-тай эхэлнэ.
- Аудио/зураг call site солих нь **шинэ** медиад л нөлөөлнө; хуучин нь DB URL-аараа
  ажиллана.
- R2 public bucket + зөв Content-Type заавал (аудио inline тоглох).

---

## 6. Env

Аль хэдийн байгаа: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_BUCKET`, `R2_PUBLIC_BASE_URL`, `R2_FOLDER`. Нэмэх (Фаз 3): Cloudflare custom
domain + Image Transformations тохиргоо.

---

## 7. Зардал (ойролцоо)

| | R2 | Cloudinary |
| --- | --- | --- |
| Storage | $0.015/GB/сар (21k зураг ≈ 10GB → ~$0.15) | credit-д |
| **Egress** | **$0** | credit-ээс их иддэг |
| Ops | Class A $4.50/сая · B $0.36/сая | — |
| Image optimize | Cloudflare Image Transformations ~$0.50/1000 | `f_auto/q_auto` (credit) |

Медиа-ихтэй апп-д R2-ийн **zero egress** нь гол хэмнэлт.

---

## 8. Дараалал + цаг

1. **Launch хүртэл:** hybrid (GLB→R2, аудио+зураг Cloudinary). Тогтвортой.
2. **Update 1 (launch дараа):** Фаз 2 (аудио → R2) — хялбар, том хэмнэлт.
3. **Update 2:** Фаз 3 (зураг → R2 + Image Transformations) — optimize орлуулаад.

> Одоо (launch-д) юу ч эвдэхгүй. Фаз 2-ыг хүсвэл яг одоо эхлүүлж болно — код бэлэн
> болгоод, backfill-ыг launch-ийн дараа ажиллуулж болно.
