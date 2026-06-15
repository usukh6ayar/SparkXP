# Сорил icon — зураг үүсгэх prompt-ууд

Бүх icon-ийг **ижил загвартай** (фокс mascot-той эвлэрсэн) болгохын тулд доорх
**нийтлэг загварын блок (STYLE)**-ийг prompt бүрийн ард залгана. Дараа нь
`assets/soril/`-д заасан нэрээр хадгална.

> Generator: Midjourney / DALL·E / Ideogram / Flux аль нь ч болно. Эцэст нь
> **дэвсгэрийг ил тод (transparent PNG)** болгож, **512×512** болгож тайрна.

---

## Нийтлэг загвар (STYLE) — prompt бүрд залгах

```
3D glossy game icon, single centered object, soft rounded shapes, smooth matte-to-glossy
plastic material with subtle soft studio lighting and a gentle highlight on top,
slight 3/4 top-down angle, playful kid-friendly mobile-game style, vibrant but clean,
brand palette purple #6C3BFF and orange #FF8A00 accents, no text, no background,
isolated on transparent background, centered with even padding, high detail, 4k render
```

**Тогтмол дүрэм (бүх icon-д):**
- Нэг л объект, төв байрлалд, эргэн тойронд жигд зай (padding) үлдээнэ.
- Дэвсгэргүй (transparent) — кодын өнгөт дөрвөлжин (tint) ард нь үлдэнэ.
- Тексттэй, лого, watermark **байж болохгүй**.
- Бүгд **512×512 px**, PNG.

---

## Icon-ууд (6 ширхэг)

| # | Файл | Тоглоом | Tint (кодод) | Гол объект |
|---|---|---|---|---|
| 1 | `game-target.png`     | Үг ангууч     | purple | Бай + сум |
| 2 | `game-headphones.png` | Сонсож барь   | blue   | Чихэвч |
| 3 | `game-bolt.png`       | Хурдан бууд   | amber  | Аянга |
| 4 | `game-link.png`       | Холбож ял     | teal   | Гинжин холбоос |
| 5 | `game-puzzle.png`     | Нөхөж дуусга  | pink   | Puzzle хэсэг |
| 6 | `game-book.png`       | Grammar Boss  | green  | Ном + хавчуурга |

### 1. `game-target.png` — Үг ангууч
```
A 3D dartboard bullseye target with concentric red, orange and white rings,
a single dart or arrow stuck near the center bullseye, [STYLE]
```

### 2. `game-headphones.png` — Сонсож барь
```
A pair of modern 3D over-ear headphones in purple and blue with glossy ear cups,
small sound waves on one side, [STYLE]
```

### 3. `game-bolt.png` — Хурдан бууд
```
A single bold 3D lightning bolt in bright golden yellow and orange, glossy and energetic,
[STYLE]
```

### 4. `game-link.png` — Холбож ял
```
Two interlocking 3D chain links in glossy teal and purple, connected together,
clean and simple, [STYLE]
```

### 5. `game-puzzle.png` — Нөхөж дуусга
```
A single glossy 3D jigsaw puzzle piece in pink and magenta, slightly tilted,
[STYLE]
```

### 6. `game-book.png` — Grammar Boss
```
A closed 3D book in green with a golden bookmark ribbon hanging out the bottom,
glossy cover, [STYLE]
```

---

## Нэмэлт (banner-д аль хэдийн бэлэн, дахин хэрэггүй бол алгасна)

### `trophy.png` — Амжилтын зам (512×512)
```
A shiny golden 3D trophy cup with a small star above it, glossy metallic gold,
purple base accent, [STYLE]
```

> Path дахь ✓ / тоо / ★ нь Ionicons хэвээр — зураг хэрэггүй.

---

## Кодод холбох (PNG бэлэн болсны дараа)

`app/(tabs)/soril.tsx` дотор:
1. Дээд талын `// const imgTarget = require(...)` мөрүүдийг **нээх**.
2. Тухайн game-ийн `// img: imgTarget,` мөрийг **нээх**.

`IconTile` нь `image` өгөгдсөн бол зургийг, үгүй бол Ionicons-ийг автоматаар
сонгоно — тиймээс нэг нэгээр нь нэмж туршиж болно.
