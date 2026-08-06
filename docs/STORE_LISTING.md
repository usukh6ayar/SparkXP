# SparkXP — App Store / Play Store material (draft)

> Owner: **Boju** (launch bundle → §3 ROADMAP). Draft-ийн текст хэсгүүд бэлэн.
> Screenshot + Privacy Policy URL (hosting) + Data Safety форм илгээх нь хүн
> шаардлагатай. Icon аль хэдийн бэлэн (`mobile/assets/icon-ios.png` 1024×1024).

---

## 1. App нэр / subtitle

- **Name:** SparkXP — Англи хэл сурах
- **Subtitle (iOS, ≤30):** Тоглоомоор англи хэл сур
- **Short description (Play, ≤80):** Тоглоомоор англи хэл сурах — үг, дүрэм, IELTS, AI ярианы найз.

## 2. Тайлбар (Mongolian — primary)

```
SparkXP бол монгол сурагчдад зориулсан тоглоомжуулсан англи хэлний апп.

• Өдөр бүр XP цуглуул, streak-ээ хадгал, чансаанд өрсөлд.
• Үг цээжлэх ухаалаг давталт (SRS), сонсгол, унших, бичих дасгал.
• IELTS бэлтгэл — Listening/Reading band оноо, Writing/Speaking жишиг хариулттай дадлага.
• AI ярианы найз — бичгээр болон дуугаар англиар яриа дадлагажуул, алдаагаа засуул.
• Хэлц үг, түвшин тус бүрийн хичээл, багшийн анги (join code / QR).

Сургууль, компани, хуулийн фирмд ч тохиромжтой. Aether Tech Core LLC.
```

## 3. Description (English — secondary)

```
SparkXP is a gamified English-learning app built for Mongolian students.

• Earn XP daily, keep your streak, and climb the leaderboard.
• Smart spaced-repetition vocabulary (SRS), listening, reading & writing drills.
• IELTS prep — Listening/Reading band scores, Writing/Speaking model-answer practice.
• AI buddy — practise English by text or voice and get your mistakes corrected.
• Idioms, level-based lessons, and teacher classes (join code / QR).

Great for schools, companies, and law firms. By Aether Tech Core LLC.
```

## 4. Keywords (iOS, ≤100 chars, comma-sep)

```
англи хэл,english,ielts,vocabulary,үг сурах,grammar,speaking,ярих,leaderboard,ai tutor
```

## 5. Category
- Primary: **Education**
- Secondary (iOS): **Reference**

## 6. Data Safety (Play) / Privacy (App Store) — хариултууд

| Асуулт | Хариулт |
| --- | --- |
| Account info (email, username) цуглуулдаг уу? | **Тийм** — бүртгэлд имэйл + username. Encrypted in transit. |
| Микрофон | **Тийм** — зөвхөн AI ярианы найз / speaking үед. Audio нь STT-д илгээгдэж боловсруулна (`AI_BUDDY_LOG_RAW_AUDIO` default OFF → бүр хадгалахгүй). |
| Камер | Зөвхөн QR код унших (анги нэгдэх). Зураг хадгалахгүй. |
| Location | **Тийм (сонголтоор)** — province/district зөвхөн орон нутгийн чансаанд. Precise location биш. |
| 3rd-party sharing | Зөвхөн AI провайдер (ElevenLabs/OpenAI/Google Gemini) руу боловсруулалтад. Зарахгүй. |
| Data deletion | Хэрэглэгч аккаунтаа устгаж болно (in-app / support имэйл). |

## 7. Screenshot shot-list (MN + EN, 6.7" + 6.5" iPhone, 1284×2778)

1. **Home** — XP/streak/Continue hero (гол дэлгэц)
2. **Lesson + video** эсвэл **Swipe үг (SRS)**
3. **Соril/Quiz** — асуултын шууд feedback + confetti үр дүн
4. **IELTS hub** — 4 модуль (band оноо)
5. **AI Buddy** — voice stage + chat sheet
6. **Leaderboard / Profile** — чансаа + avatar

> Screenshot-ыг бодит утсан дээр (эсвэл simulator) авч, дээр нь богино гарчиг тавина
> (MN: "Тоглоомоор сур", "IELTS band", "AI-тай ярь"; EN эквивалент).

## 8. Privacy Policy
- Богино privacy policy хуудас host хийх шаардлагатай (Vercel/GitHub Pages).
- URL-ыг App Store Connect + Play Console 2 газарт оруулна.
- Агуулга: §6-ийн хүснэгтийг өгүүлбэр болгож бичих + support имэйл
  (`aerielsporthub@gmail.com` эсвэл албан ёсны support).

---

## 9. Splash screen (lead-д handoff — `app.json` = lead-only)

> CLAUDE.md: `app.json`/native config зөвхөн **Өсөхбаяр** засна. Доорх snippet бэлэн —
> lead жижиг PR-аар нэмнэ. Asset: `mobile/assets/splash.png` (fox/logo,
> `#191040` дэвсгэр дээр төвд, ~1284×2778 эсвэл logo-only 1242×1242).

`app.json` → `expo` доор нэмэх:
```json
"splash": {
  "image": "./assets/splash.png",
  "resizeMode": "contain",
  "backgroundColor": "#191040"
}
```
Хэрэв тусдаа splash art бэлэн болоогүй бол түр зуур `./assets/icon.png`-ийг
`splash.image` болгож болно (logo төвд, `#191040` дэвсгэр) — store blocker биш ч
launch-д цагаан дэлгэц гарахаас сэргийлнэ.
