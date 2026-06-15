# Onboarding & Auth — фокс mascot зураг үүсгэх prompt-ууд

Одоогоор дэлгэцүүд түр зуур `assets/logo.png` (фокс тэмдэг)-ийг ашиглаж байгаа.
Доорх 5 зураг бэлэн болсон үед солино (заавар хамгийн доор).

Бүгд **фокс mascot**-той (soril icon-уудтай ижил 3D glossy загвар), ягаан
`#6C3BFF` + улбар `#FF8A00` палитр, **дэвсгэргүй (transparent PNG)**, төвлөрсөн.

---

## Нийтлэг загвар (STYLE) — prompt бүрд залгах

```
3D render of a friendly cartoon fox mascot, orange fur, wearing a purple #6C3BFF
hoodie with "XP" on the chest, glossy Pixar-like style, soft studio lighting,
big expressive eyes, kid-friendly, vibrant, full body, no text, no background,
isolated on transparent background, centered, high detail, 4k
```

---

## Зургууд

| Файл | Дэлгэц | Хэмжээ | Поз / Объект |
|---|---|---|---|
| `onb-welcome.png` | Onboarding 1 | 800×800 | Гараа даллаж мэндчилж буй (waving) |
| `onb-xp.png`      | Onboarding 2 | 800×800 | Алтан цом өргөж, XP зоос + цэнхэр алмаз |
| `onb-ai.png`      | Onboarding 3 | 800×800 | Чихэвчтэй, зөөврийн компьютерт суусан |
| `success-fox.png` | Бүртгэл амжилттай | 800×800 | Эрхий хуруугаа өргөсөн (thumbs up), баяртай |
| `map-fox.png`     | Байршил сонгох | 600×600 | Газрын зураг / location pin барьсан |

### `onb-welcome.png`
```
A cartoon fox mascot happily waving one paw, friendly smile, [STYLE]
```

### `onb-xp.png`
```
A cartoon fox mascot proudly holding up a golden trophy, a glowing purple XP coin
and a blue diamond gem floating around it, celebrating, [STYLE]
```

### `onb-ai.png`
```
A cartoon fox mascot wearing purple headphones, sitting at a laptop and giving a
thumbs up, a small chat bubble nearby, [STYLE]
```

### `success-fox.png`
```
A cartoon fox mascot giving a big thumbs up, cheerful celebrating pose, confetti
around it, [STYLE]
```

### `map-fox.png`
```
A cartoon fox mascot holding a folded map with a red location pin, looking curious,
[STYLE]
```

---

## Кодод холбох (PNG бэлэн болсны дараа)

1. **Onboarding** — `app/(auth)/onboarding.tsx`: `SLIDES` массив дахь слайд бүрд
   `image` талбар нэмж, `MascotCircle`-д дамжуулна. Жишээ:
   ```ts
   const imgWelcome = require('../../assets/onboarding/onb-welcome.png');
   // slide: { ..., image: imgWelcome }
   // <MascotCircle image={s.image} ... />
   ```
2. **Бүртгэл амжилттай** — `app/(auth)/register.tsx` дахь `const fox = require('../../assets/logo.png')`-ийг
   `success-fox.png`-ээр (success step) болон `map-fox.png`-ээр (location step) солино.
3. **Login** — доод буланд байгаа фоксыг хүсвэл `onb-welcome.png`-ээр сольж болно.

> `MascotCircle` ямар ч зураг авдаг тул нэг нэгээр нь сольж туршаад болно.
