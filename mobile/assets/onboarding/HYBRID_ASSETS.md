# Hybrid onboarding — шаардлагатай зургууд

Шинэ onboarding урсгал (`app/(auth)/onboarding/`) одоогоор **байгаа жинхэнэ
зургуудыг** ашиглаж байгаа. Доор жагсаасан 3 зураг бэлэн болмогц сольвол
дизайн бүрэн болно.

> ⚠️ **Placeholder ашиглаагүй.** `assets/onboarding/`-д байгаа
> `onb-welcome.webp`, `onb-xp.webp`, `onb-ai.webp`, `success-fox.webp`,
> `map-fox.webp` таван файл нь **яг ижил 17,350 байт** — өөрөөр хэлбэл бүгд нэг
> л түр зургийн хуулбар (`md5 = a7f2e9b0…`). Тиймээс шинэ урсгал тэдгээрийг
> огт ашиглахгүй. (`map-fox` / `success-fox` хоёрыг **устгаж болохгүй** —
> `app/(auth)/register.tsx` одоо ч require хийж байна.)

---

## Одоо юу ашиглаж байна

| Дэлгэц | Одоогийн зураг | Тайлбар |
| --- | --- | --- |
| 1 · Welcome | `assets/logo.webp` | Номтой үнэг, дэвсгэргүй. Login дэлгэцийн hero-тэй ижил. |
| 5 · AI Buddy demo | `assets/buddy-menu.webp` | Дуулга зүүсэн, даллаж буй үнэгний дугуй аватар. |
| 6 · Хувийн төлөвлөгөө | `assets/logo.webp` | Түр — доорх `onb-plan-fox` бэлэн болмогц солино. |

Бусад бүх дүрс нь **Ionicons** vector glyph (сонголтын карт, төлөвлөгөөний мөр,
доод товчнууд) — зураг шаардахгүй, өнгө нь theme-ээс автоматаар авна.

---

## Захиалах ёстой 3 зураг

Нийтлэг шаардлага:

- **Transparent background (PNG эсвэл WebP alpha-тай)** — заавал.
- **Зураг дотор ямар ч текст байж болохгүй** (гарчиг, товчны бичиг, "XP"
  үсэг бүхий тэмдэг ч үгүй). Бүх текст UI-аас гарна.
- Стиль: `assets/logo.webp`-тэй ижил — 3D glossy Pixar маягийн үнэг, улбар шар
  үс, ягаан `#6C3BFF` hoodie, зөөлөн студийн гэрэлтүүлэг, том илэрхий нүд.
- Төвлөрсөн, бүтэн бие, 4k, дэвсгэргүй.

### 1. `onb-welcome-fox.webp` — 1024×1024

Welcome дэлгэцийн hero. Одоогийн `logo.webp` нь номтой сууж буй тул мэндчилгээ
илэрхийлэхгүй байна.

```
3D render of a friendly cartoon fox mascot standing and waving one paw in
greeting, warm welcoming smile, orange fur, purple #6C3BFF hoodie, glossy
Pixar-like style, soft studio lighting, big expressive eyes, kid-friendly,
full body, centered, no text, no letters, no background, isolated on
transparent background, high detail, 4k
```

### 2. `onb-plan-fox.webp` — 1024×1024

Төлөвлөгөө бэлэн болсны баярын дүр. Алтан од `#FFC93C` барина — цом, зоос,
алмаз зэрэг тоглоомын объект **бүү нэм** (нэг л шагналын элемент).

```
3D render of a cheerful cartoon fox mascot holding up a single glowing golden
star with both paws, celebrating, confident happy expression, orange fur,
purple #6C3BFF hoodie, glossy Pixar-like style, soft studio lighting, full
body, centered, no text, no letters, no background, isolated on transparent
background, high detail, 4k
```

### 3. `onb-buddy-fox.webp` — 800×800

AI Buddy demo дэлгэцийн ярианы дүр. Одоогийн `buddy-menu.webp` нь ягаан дугуй
дэвсгэртэй (өөрөө хүрээ үүсгэдэг) тул шинэ дэвсгэргүй хувилбар илүү зөв суудаг.

```
3D render of a cartoon fox mascot wearing a slim purple headset with a boom
microphone, speaking with an encouraging smile, head and shoulders only,
orange fur, purple #6C3BFF hoodie, glossy Pixar-like style, soft studio
lighting, centered, no text, no letters, no speech bubble, no background,
isolated on transparent background, high detail, 4k
```

---

## Кодод холбох

Файл нэмсний дараа `require`-ийг л солино:

| Файл | Мөр |
| --- | --- |
| `app/(auth)/onboarding/index.tsx` | `const fox = require('../../../assets/onboarding/onb-welcome-fox.webp')` |
| `app/(auth)/onboarding/plan.tsx` | `const fox = require('../../../assets/onboarding/onb-plan-fox.webp')` |
| `app/(auth)/onboarding/buddy.tsx` | `const buddy = require('../../../assets/onboarding/onb-buddy-fox.webp')` |

Layout / хэмжээ өөрчлөх шаардлагагүй — гурвуулаа `resizeMode="contain"`-тэй
хайрцагт суудаг.

---

## Ашиглагдахаа больсон файлууд

`onboard1.png` · `onboard2.png` · `onboard3.png` (нийт ~4.6 MB) — хуучин
3-слайдын **гарчиг нь зураг дотроо шатаасан** background artwork. Шинэ урсгалд
ашиглагдахгүй бөгөөд "зураг дотор текст байж болохгүй" дүрэмд ч харшилдаг.
Устгах эсэхийг эзэмшигч шийднэ (одоохондоо хэвээр үлдээв).
