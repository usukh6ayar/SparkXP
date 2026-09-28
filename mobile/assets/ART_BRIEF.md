# SparkXP — Art brief: нэг ертөнц, нэг үнэг (2026-09-28)

Даалгавар #2 (үнэгнүүдийг нэг style-тэй болгох), #3 (Lesson world зургууд),
#4 (арал бүрийн арын зураг) — **юу хийгдсэн, юу үлдсэн, үлдсэнийг яг яаж үүсгэх.**

## 1. Аудит (PR #277-ийн дараа)

**Брэндийн эталон — «Spark» үнэг:** 3D, Pixar-маягийн, улбар шар үнэг, том бор
нүд, ягаан-нил hoodie (**#6C3BFF**), цагаан уяа; buddy контекстэд нил чихэвч.

| Файл | Хаана | Төлөв |
| --- | --- | --- |
| `buddy-tab.webp`, `buddy-menu.webp`, `avatars/av1.webp` | Buddy, тохиргоо, аватар | ✅ Эталон |
| `fox-island.webp`, `soril-banner.webp`, `avatars/lessonAvatar.webp` | Нүүр, Сорилт, түвшний карт | ✅ PR #277-оор Spark болсон |
| `levels/world-*.webp`, `levels/a1-*.webp` | Хичээлийн ертөнц, A1 түвшин | ✅ PR #277 |
| `onboarding/map-fox.webp`, `onboarding/success-fox.webp` | **Бүртгэл** (`app/(auth)/register.tsx`) | ❌ **2D flat, hoodie-гүй** — хэрэглэгчийн хамгийн түрүүнд хардаг үнэг брэндтэй зөрдөг |
| `onboarding/onb-ai|onb-welcome|onb-xp.webp` | Ашиглагдаагүй | 🗑 Энэ PR-т устгасан |
| `levels/a2…c2-*.webp` | A2–C2 түвшин | ⏳ Байхгүй — ойн арын зураг руу fallback |
| `avatars/islands/c2*.webp` | «Нарийн утгын ертөнц» арал | ⚠️ B1-ийн хоёр дахь цайз — нэртэйгээ нийцэхгүй |

> ⚠️ Локал `backend/.env`-ийн `OPENAI_API_KEY` хүчингүй (401), `GEMINI_API_KEY`
> хоосон тул эдгээрийг энэ удаа үүсгээгүй. Production түлхүүрийг зөвшөөрөлгүй
> ашиглаагүй. Нийт ~12 зураг, ойролцоогоор $2–4.

## 2. Үүсгэх

```bash
mkdir -p /tmp/art && cd /tmp/art
A=~/Desktop/Projects/SparkXP/mobile/assets
sips -s format png $A/buddy-tab.webp --out ref_fox.png
sips -s format png $A/avatars/lessonAvatar.webp --out ref_fox_body.png
sips -s format png $A/levels/a1-light.webp --out ref_map_light.png
sips -s format png $A/levels/a1-dark.webp --out ref_map_dark.png
sips -s format png $A/avatars/islands/c1_light.webp --out ref_island.png
export OPENAI_API_KEY=sk-...
G=~/Desktop/Projects/SparkXP/mobile/scripts/gen-art.py
```

### 2a. Бүртгэлийн 2 үнэг

```bash
SIZE=1536x1024 BG=transparent python3 $G map-fox.png "The SAME fox character as the references (orange 3D fox, purple #6C3BFF hoodie, Pixar style), running forward happily holding a rolled treasure map, golden sparkles trailing, full body, transparent background, no text." ref_fox.png ref_fox_body.png
SIZE=1536x1024 BG=transparent python3 $G success-fox.png "The SAME fox character as the references, leaping with both arms raised in celebration, golden sparkles and a small star burst, full body, transparent background, no text." ref_fox.png ref_fox_body.png
```

### 2b. A2–C2 түвшний газрын зураг (10 ширхэг)

`LevelMapBackdrop`-ийн хэлбэр: **өндөр portrait** (A1 = 1024×4248), зам доороос
дээш өгсөж, оройд нь түвшний дурсгалт газар. Model 1024×1536-аас том гаргадаггүй
тул 3 хэсгээр үүсгээд `magick a.png b.png c.png -append out.png`-ээр залгана
(хэсэг бүрд өмнөх хэсгийн дээд ирмэгийг reference болгож өгвөл үе нь нийлнэ).

Нийтлэг төгсгөл: `Match EXACTLY the painterly 3D style, palette and detail of the reference level map. Tall vertical scene, a winding path climbs from bottom to top. No text, no characters, no UI.`

| Файл | Ref | Сэдэв |
| --- | --- | --- |
| `a2-light/dark` | `ref_map_*` | **Цагийн тосгон** — чулуун зам, модон байшингууд, цагны цамхаг, нарны цаг, салхин тээрэм; оройд нь том цагны цамхаг |
| `b1-light/dark` | `ref_map_*` | **Өгүүлбэрийн цайз** — гүүр, цайзын хаалга, туг, бамбар; оройд нь цайз |
| `b2-light/dark` | `ref_map_*` | **Нөхцөл бүтцийн уул** — цасан уулын ороомог зам, цэнхэр болор; оройд нь оргил |
| `c1-light/dark` | `ref_map_*` | **Дүрмийн галактик** — алтан одны зам, мананцар, цагирагт гараг |
| `c2-light/dark` | `ref_map_*` | **Нарийн утгын ертөнц** — үүлэн дээгүүр гэрэлтэх чулуун гишгүүр, хөвөх ном, солонго цацах болор; оройд нь болор номын сан |

Нэмэх: `src/components/LevelMapBackdrop.tsx`-ийн `LEVEL_MAPS`-д a1-ийн адил мөр.

### 2c. C2 арал (2 ширхэг)

```bash
SIZE=1024x1024 BG=transparent python3 $G c2_light.png "Floating fantasy island in the exact style of the reference: 'Nuance Realm' — a crystal library tower, floating open books, prisms splitting light into rainbows, waterfalls off the rock base, soft clouds. Transparent background. No text." ref_island.png
SIZE=1024x1024 BG=transparent python3 $G c2.png "Same island at night: violet glow, starlight on the crystals, books glowing softly. Transparent background. No text." c2_light.png
```

## 3. Байршуулах + QA

```bash
for f in *.png; do cwebp -q 82 "$f" -o "${f%.png}.webp"; done
# map-fox/success-fox → assets/onboarding/ (дарж бичнэ, код өөрчлөхгүй)
# a2…c2-*.webp → assets/levels/ + LEVEL_MAPS мөр · c2*.webp → assets/avatars/islands/
```

Dark + light горимд: бүртгэлийн үнэг бусад дэлгэцийн Spark-тай адилхан эсэх,
түвшин бүрийн node уншигдах эсэх, C2 арал B1-тэй андуурагдахгүй эсэх.
