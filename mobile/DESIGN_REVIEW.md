# SparkXP — UX/UI Design Review (2026-07-05)

> **Багийн бүрэлдэхүүн (энэ review-г бэлдсэн өнцөг):** Senior Product Designer ·
> UX Researcher · Interaction Designer · Design System Expert.
>
> **Scope:** `mobile/` — Expo (React Native) апп. Design system (`theme.ts`),
> 40 route/дэлгэц, 47 shared component, navigation, motion, haptics, spacing,
> typography, color, accessibility.
>
> **Аргачлал:** `theme.ts` + `DESIGN.md`-г эх сурвалж болгож, гол урсгалын дэлгэц
> (Home, Quiz, Lesson, Profile, Chat) болон гол компонент (Button, CustomTabBar,
> ProgressBar) -ийг мөр мөрөөр нь уншиж, бүх дэлгэц/компонентыг нэрсээр нь
> хамарч, dependency + ашиглалтын статистик (`grep`) дээр тулгуурлав.

---

## 0. Товч дүгнэлт (Executive Summary)

SparkXP-ийн **суурь маш чанартай**: `theme.ts` бол жинхэнэ design system —
семантик token, light/dark palette, 4pt spacing scale, intent-based typography,
glow elevation, tint pair-ууд бүгд байгаа. `CustomTabBar` (liquid-glass),
Home hero (fox-island composite) хоёр premium түвшний.

Гэхдээ **"premium / delightful / playful"** мэдрэмж дутаж байгаа гол шалтгаан нь
**кодын чанар биш — MOTION ба FEEDBACK дутагдал**. Тодруулбал:

| Асуудал | Нотолгоо | Нөлөө |
| --- | --- | --- |
| **Haptic бараг байхгүй** | `expo-haptics` суусан ч зөвхөн **1 файлд** ашиглагдсан | Delight, "kайфтай" мэдрэмж алга |
| **Motion бараг байхгүй** | `react-native-reanimated` v4 суусан ч зөвхөн **4 файлд** | Хөдөлгөөнгүй, "хямд" мэдрэмж |
| **Theme migration өр** | **46 файл** static `colors` импортолсон → dark-д царцсан | Light toggle бүрэн ажиллахгүй → inconsistency |
| **CTA glow ашиглагдаагүй** | `primaryGradient` (glow) байгаа ч Button flat `colors.primary` ашигладаг | Товч энгийн, premium биш |
| **Press feedback сул** | Хаа сайгүй `scale: 0.99` (бараг мэдэгдэхгүй) | Tactile мэдрэмж алга |
| **Instant feedback loop алга** | Quiz — хариу бүрт зөв/буруу мэдэгдэхгүй, зөвхөн эцэст нь | Duolingo-ийн dopamine loop алга |
| **Celebration алга** | Quiz result = static 🎉 emoji, confetti/haptic алга | Reward feeling сул |

**Гол санаа:** 80% сайжруулалт нь **шинэ дизайн зурах биш**, аль хэдийн суусан
`expo-haptics` + `reanimated`-ыг ашиглаж, `theme.ts`-д байгаа token-уудыг
(`primaryGradient`, `elevation`, `useColors`) бүрэн эдлэхэд оршино. Энэ бол
хямд өртөгтэй, өндөр үр дүнтэй ажил.

### Оноо (100-аар)

| Ангилал | Оноо | Тайлбар |
| --- | --- | --- |
| **Visual Design** | 82 | Token system маш сайн; hierarchy зөв; зарим дэлгэц raw `Text` ашигласан |
| **UX (flow)** | 78 | Flow ойлгомжтой; instant-feedback loop, empty/skeleton зарим дэлгэцэд дутуу |
| **UI (consistency)** | 70 | Button/tab premium; гэхдээ 46 файл theme-д царцсан, radius/press зөрүүтэй |
| **Interaction** | 58 | Tap ажилладаг; gesture/swipe/long-press бараг ашиглаагүй |
| **Animation** | 45 | Reanimated суусан ч 4 файлд; entrance/transition/celebration алга |
| **Accessibility** | 55 | Touch target ихэвчлэн зөв; a11y label, dynamic font, contrast шалгаагүй |
| **Consistency** | 68 | Design system байгаа ч мөрдөлт тэгш бус (static colors, raw Text) |
| **Premium Feeling** | 72 | Hero + tab bar premium; flat CTA, motion дутагдал татаж буулгана |
| **Playfulness** | 60 | Fox mascot, gamification token сайн; амьд хөдөлгөөн/celebration дутуу |
| **Delight** | 45 | Haptic/micro-interaction/success анимаци бараг байхгүй |
| **OVERALL** | **64 / 100** | Суурь бат; motion + feedback + theme-migration дуусгавал 85+ болно |

---

## 1. Системийн түвшний олдворууд (эдгээр нь БҮХ дэлгэцэд нөлөөлнө)

> Эдгээрийг эхэлж засвал 40 дэлгэц зэрэг сайжирна. Дэлгэц бүрийн жижиг зассанаас
> хамаагүй үр дүнтэй. **Хамгийн эхэнд эдгээрийг хий.**

### 🟥 S1. Haptic feedback — бүх үндсэн үйлдэлд нэм
- **Одоо:** `expo-haptics` суусан ч зөвхөн 1 файлд. Товч дарах, хариу сонгох,
  XP авах, streak өсөх, tab солих, pull-to-refresh — бүгд "чимээгүй".
- **Яагаад:** Premium апп бүр (Duolingo, Linear, Apple) tactile хариу өгдөг.
  Энэ бол "кайфтай" мэдрэмжийн №1 эх сурвалж, хамгийн хямд ажил.
- **Яаж:** Дундын жижиг helper гарга — `src/lib/haptics.ts`:
  ```ts
  import * as Haptics from 'expo-haptics';
  export const tap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  export const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  export const error = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  export const select = () => Haptics.selectionAsync();
  ```
  Дараа нь `Button`, quiz option, tab press, correct/wrong, XP badge-д дуудна.
  (Хамгийн эхэнд `Button.tsx` + `CustomTabBar` + `quiz/[id].tsx`-д.)

### 🟥 S2. Press animation — `scale: 0.99` хэт сул
- **Одоо:** Home/quiz бүгд `pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }`.
  0.99 бол нүдэнд бараг мэдэгдэхгүй.
- **Яаж:** `0.96–0.97` болго, эсвэл Reanimated `withSpring`-ээр bounce нэм. Дундын
  `<Pressable>` wrapper (`PressableScale`) гарган хаа сайгүй reuse хий (DRY).

### 🟥 S3. CTA glow gradient ашиглагдаагүй
- **Одоо:** `theme.ts:23` `primaryGradient` ("glowing CTA") тодорхойлсон ч
  `Button.tsx` flat `colors.primary` ашигладаг. Home continueCard л gradient
  хэрэглэсэн.
- **Яагаад:** DESIGN.md шууд "glowing violet gradient" гэж заасан. Flat нь premium
  мэдрэмжийг хамгийн их бууруулдаг элемент.
- **Яаж:** `Button` primary variant-д `LinearGradient` (`c.primaryGradient`) +
  зөөлөн `elevation` glow нэм.

### 🟥 S4. Theme migration өр — 46 файл dark-д царцсан
- **Одоо:** `grep` → **46 файл** `import { colors } from '../theme'` шууд ашигладаг
  (`DESIGN.md` өөрөө "static colors импорт = migration өр" гэж бичсэн). Light
  toggle дарахад эдгээр дэлгэц/элемент солигдохгүй → inconsistent.
- **Яаж:** Багаар зохицуулж жижиг PR-аар `useColors()`/`useTheme()` рүү шилжүүл.
  **Эхлэх ёстой:** shared components (`Button`, `CustomTabBar`, `ProgressBar`) —
  эдгээр хаа сайгүй ашиглагддаг тул нэг зассан нь олон дэлгэцийг зэрэг засна.

### 🟥 S5. Instant feedback loop алга (learning core)
- **Одоо:** `quiz/[id].tsx` — хариу сонгоход зөвхөн border солигдоно; зөв/буруу
  эсэхийг **зөвхөн эцэст нь** харуулна. Энэ нь Duolingo/Quizlet-ийн гол dopamine
  loop-ыг алдагдуулна.
- **Яаж:** Хариу сонгоод "Шалгах" дарахад тухайн үед зөв=ногоон+success haptic,
  буруу=улаан shake+error haptic үзүүл, зөв хариуг тодруул, дараа нь "Дараах".

### 🟨 S6. Entrance / list animation алга
- **Одоо:** Дэлгэц нээхэд бүх карт зэрэг "цойлдог". Stagger/fade-in алга.
- **Яаж:** `reanimated`-ийн `FadeInDown.delay(i*60)` list item-д нэм (Home tasks,
  lessons, leaderboard rows). Маш бага код, том premium нөлөө.

### 🟨 S7. `AppText` vs raw `Text` зөрүү
- **Одоо:** Home `AppText variant=...` (сайн) ашигладаг; `quiz/[id].tsx` бүхэлдээ
  raw `<Text style={styles...}>` + `fontSize.*` (legacy) ашигласан.
- **Яаж:** Бүх дэлгэцийг `AppText variant`-руу нэгтгэ. Typography hierarchy нэг
  эх сурвалжаас ирнэ (`typography.*`), `fontSize.*` legacy-г зогсоо.

### 🟨 S8. Placeholder өгөгдөл premium-ийг унагадаг
- **Одоо:** Home `continueProgress = 0.75` hardcoded (`TODO(data)`), streak/level
  зарим нь placeholder. Хэрэглэгч 75%-ийг үргэлж хардаг → итгэл алдагдана.
- **Яаж:** Backend-ээс жинхэнэ per-lesson progress авах (энэ таны backend талын
  ажил) эсвэл өгөгдөл байхгүй бол progress мөрийг нууж, "Эхлүүлэх" гэж үзүүл.

---

## 2. Дэлгэц бүрээр (Screen-by-screen)

### 2.1 🏠 Home — `app/(tabs)/index.tsx`
**Хүчтэй тал:** Fox-island composite hero гоё; streak/gem/XP badge scene дээр
давхарласан нь premium; skeleton биш ч RefreshControl байгаа.

- 🟥 **Skeleton loading алга** — эхний ачаалалд XP/streak/tasks 0-оос "үсэрч"
  орно. `Skeleton` компонент байгаа тул hero badge + task grid-д тавь.
- 🟥 **continueProgress placeholder (75%)** — S8. Жинхэнэ өгөгдөл эсвэл нуу.
- 🟨 **Task grid `width: "23%"`** — 4 баганы хооронд зай тааруу, жижиг дэлгэцэд
  шахагдана. `flexBasis` + `gap` ашигла, эсвэл 2×2 том tile болго (thumb-friendly,
  playful).
- 🟨 **Streak badge статик** — flame icon хөдөлдөггүй. Streak > 0 үед flame-д
  зөөлөн pulse (reanimated loop) нэмбэл амьд болно.
- 🟨 **"Continue" карт дээрх `Aa`** — жинхэнэ хичээлийн thumbnail байвал илүү
  premium (одоо зүгээр текст).
- 🟩 **Entrance stagger** (S6) — task tile-ууд дараалан fade-in.

### 2.2 📚 Lessons — `app/(tabs)/lessons.tsx` + `app/level/[code].tsx`
"Хичээлийн ертөнц" adventure map (island tier) — playful санаа сайн.
- 🟨 **Map node руу шилжих transition** — node дарахад instant navigate. Zoom/scale
  shared-element transition premium болгоно.
- 🟨 **Lock/unlock reveal** — түгжээ задрах анимаци + haptic нэмбэл reward feeling.
- 🟩 **Progress path fill** — замын дагуух progress-ыг анимацтай дүүргэ.
- ⚠️ **Гүн audit хийгээгүй** (энэ дэлгэцийг мөр мөрөөр уншаагүй) — дээрх нь map
  UX-ийн ерөнхий зарчим.

### 2.3 🏆 Soril / Quiz — `app/(tabs)/soril.tsx`, `app/quiz/[id].tsx`, `app/game/[mode].tsx`
**Энэ бол gamification-ийн зүрх — хамгийн их delight хэрэгтэй хэсэг.**
- 🟥 **Instant feedback алга** (S5) — хариу зөв/буруу эцэст нь. Заавал засах.
- 🟥 **Answer select — haptic + animation алга** — option дарахад зөвхөн border.
  `selection()` haptic + зөөлөн scale нэм.
- 🟥 **Result celebration сул** — `result.passed` үед static 🎉 emoji. Confetti
  (reanimated / lottie), success haptic, XP badge count-up анимаци нэм. Одоо XP
  badge зүгээр "цойлдог".
- 🟨 **Progress bar instant jump** — `width: %` шууд солигддог. `withTiming`-ээр
  дүүргэ.
- 🟨 **word_match — drag&drop илүү playful** — одоо tap-tap. gesture-handler
  байгаа тул drag холбоос илүү "тоглоомтой".
- 🟨 **raw `Text` + `fontSize.*`** (S7) — `AppText`-руу шилжүүл.
- 🟩 **Timer / streak-in-quiz** — Duolingo combo мэдрэмж (заавал биш).

### 2.4 🦊 Chat / AI Buddy — `app/(tabs)/chat.tsx`, `app/buddy-memory.tsx`, `app/avatar.tsx`
- 🟨 **Typing indicator / message анимаци** — AI хариу бичих үед "..." + fade-in
  bubble. Chat premium болгодог гол зүйл.
- 🟨 **Voice UI** (coming soon төлөв) — CLAUDE.md-ийн дагуу одоо stub; UI-г
  "coming soon"-оор эвтэйхэн харуул (mic pulse ring гэх мэт).
- ⚠️ **Гүн audit хийгээгүй.**

### 2.5 👤 Profile — `app/(tabs)/profile.tsx`, `app/settings.tsx`
`premiumThemes` palette-ийг ашигладаг гэж баримтжуулсан — light/dark reactive.
- 🟨 **Stat count-up** — XP/streak/level тоо орж ирэхэд count-up анимаци.
- 🟨 **Avatar edit хэсэг** — `EditProfileModal` байгаа; modal нээх/хаах spring
  transition + haptic.
- 🟩 **Level progress ring** — шугаман bar-аас илүү тойрог ring premium.
- ⚠️ **Гүн audit хийгээгүй.**

### 2.6 🔐 Auth / Onboarding — `app/(auth)/onboarding.tsx`, `login.tsx`, `register.tsx`, `forgot.tsx`
- 🟨 **Onboarding slide transition** — 3-slide; parallax/fade + progress dot
  анимаци premium first-impression өгнө (энэ бол хэрэглэгчийн ХАМГИЙН эхний
  сэтгэгдэл — их чухал).
- 🟨 **Form validation feedback** — алдааг inline + зөөлөн shake + error haptic.
  `FormError` компонент байгаа.
- 🟩 **Keyboard avoiding + автомат focus** — талбар хооронд "Дараах".
- ⚠️ **Гүн audit хийгээгүй.**

### 2.7 📖 Reading — `app/reading/index.tsx`, `app/reading/[id].tsx`
Tap-to-translate (double-tap word) UX сайн санаа.
- 🟨 **Double-tap → translate reveal** — орчуулга гарч ирэхэд bottom-sheet
  fade/slide + haptic. `SelectableText` компонент байгаа.
- 🟨 **Reading progress** — унших явцын progress bar (scroll-linked).
- ⚠️ **Гүн audit хийгээгүй.**

### 2.8 🥇 Leaderboard — `app/leaderboard.tsx`, `src/components/LeaderboardRow.tsx`
- 🟨 **Rank change анимаци** — мөр орж ирэхэд stagger fade-in; топ-3 онцгой
  badge/glow.
- 🟩 **Өөрийн мөр "sticky"** — гүйлгэхэд өөрийн байрыг доор наах.
- ⚠️ **Гүн audit хийгээгүй.**

### 2.9 👩‍🏫 Teacher — `app/(teacher)/*`
- 🟨 **Class/assign flow** — олон алхамтай; progress + empty state тодорхой байх.
- 🟩 **Join code / QR** — `JoinCodeCard` дээр "хуулсан" haptic + toast.
- ⚠️ **Гүн audit хийгээгүй** (энэ хэсэг өргөн, тусад нь review хийх нь зүйтэй).

---

## 3. Компонент бүрээр (Component-by-component)

### 🟥 `Button.tsx`
- Static `colors` ашигладаг (`fg`, `primary`, `secondary`) → theme toggle
  бүрэн ажиллахгүй (S4). `useColors()`-руу бүрэн шилжүүл.
- Flat fill → `primaryGradient` glow нэм (S3).
- Haptic алга (S1) → primary press дээр `tap()`.
- `pressed scale 0.99` → 0.97 (S2).
- **Нэг Button-ыг зассан нь ~30 дэлгэцийг зэрэг сайжруулна.**

### 🟩 `CustomTabBar.tsx` — premium (сайн жишээ)
- Liquid-glass (BlurView + sheen + active chip) маш сайн.
- Дутуу: **tab press haptic алга** (S1) — `select()` нэм. Active chip solих
  анимацгүй (instant) — `withSpring`-ээр гулсуулбал төгс.

### 🟨 `ProgressBar.tsx`
- Value солиход instant jump байх магадлалтай → `withTiming` fill нэм. XP/quiz/
  reading бүх progress-д reuse хийгддэг тул нэг зассан нь өргөн нөлөөтэй.

### 🟨 `Text.tsx` (`AppText`)
- Сайн (variant-based). Асуудал нь: зарим дэлгэц үүнийг ашиглахгүй raw `Text`
  бичсэн (S7). Компонент биш — мөрдөлтийн асуудал.

### 🟨 Дундын жижиг компонентууд (`Card`, `Pill`, `IconTile`, `StatCard`, `SelectField`, `EmptyState`, `Skeleton`)
- Багц нь баялаг, DRY-д сайн. Шалгах зүйл: бүгд `useColors()` ашигладаг эсэх
  (static царцсан эсэх — S4), press feedback нэгдсэн эсэх, radius нийцтэй эсэх.
- `radius` scale-д `md=16` ба `sm=12` хоёулаа байна — компонент бүр аль нэгийг
  тогтвортой сонгосон эсэхийг шалга (radius зөрүү premium-ийг унагадаг).

---

## 4. Accessibility (a11y)

- 🟥 **`accessibilityLabel` / `accessibilityRole` алга байх магадлалтай** — icon-only
  товч (`IconButton`, tab, back) screen reader-т "unlabeled" болно. `IconButton`,
  `CustomTabBar`, header icon-д label нэм.
- 🟨 **Dynamic Font Scale** — `fontSize` тогтмол px. iOS/Android том фонт
  тохиргоонд layout эвдрэх эсэхийг шалга (`allowFontScaling`, min touch 44pt).
- 🟨 **Contrast** — dark theme дээр `textMuted #8E80BC` on `surface #2A1E5C` —
  WCAG AA (4.5:1) хангаж байгаа эсэхийг шалга (caption/hint жижиг текст эрсдэлтэй).
- 🟩 **Touch target** — ихэнх нь 44+ (tab 34px chip нь жижиг — hitSlop нэм).
- 🟩 **Reduce Motion** — анимаци нэмэхдээ `AccessibilityInfo.isReduceMotionEnabled`
  хүндэтгэ.

---

## 5. Playfulness & Premium — тодорхой нэмэлтүүд

**Playful (хэт хүүхдийн биш, дулаахан):**
- Fox mascot-ыг илүү "амьд" болго — idle blink/breathe анимаци (loop), зөв
  хариунд баярлах, streak дээр "гал асаах" reaction.
- Micro-celebration: XP авах бүрт жижиг "+15 XP" toast дээшээ хөвөх + haptic.
- Empty state-үүдэд fox + дулаахан текст (одоо `EmptyState` бий — mascot нэм).

**Premium (высокого класса):**
- Flat CTA → glow gradient (S3).
- Instant swap → spring/timing transition (S2, S6).
- Count-up тоонууд (XP/streak/score).
- Нэгдсэн radius + spacing (design system-ээ 100% мөрдө → S4, S7).
- Skeleton хаа сайгүй (Home, profile) — "цойлдог" ачаалалыг арилга.

---

## 6. ХАМГИЙН ЧУХАЛ 50 САЙЖРУУЛАЛТ (priority-жуулсан)

> 🟥 High = premium/delight-д хамгийн их нөлөөтэй, хямд · 🟨 Medium · 🟩 Low.
> Дугаарлалт нь **хийх дараалал** (эхний 12 нь 80% үр дүн).

**🟥 High (эхэлж хий — системийн, өргөн нөлөө):**
1. `src/lib/haptics.ts` helper гарган Button/tab/quiz-д haptic холбо (S1).
2. `Button` — `primaryGradient` glow + `useColors` бүрэн шилжүүлэлт (S3, S4).
3. Press feedback `scale 0.99 → 0.97` + spring, дундын `PressableScale` (S2).
4. Quiz — хариу бүрт instant зөв/буруу feedback loop (S5).
5. Quiz result — confetti + success haptic + XP count-up celebration.
6. Tab press дээр `selection()` haptic + active chip spring transition.
7. Shared components (`Button`,`CustomTabBar`,`ProgressBar`) → static colors устга.
8. `ProgressBar` — `withTiming` анимацтай дүүргэлт (XP/quiz/reading бүгд ашиглана).
9. Home — skeleton loading (hero badge + task grid).
10. Home `continueProgress` placeholder (75%) — жинхэнэ өгөгдөл/эсвэл нуу (S8).
11. Quiz answer select — `selection()` haptic + зөөлөн scale.
12. List entrance stagger (`FadeInDown`) — Home tasks, lessons, leaderboard (S6).

**🟥 High (learning/first-impression чанар):**
13. Wrong answer дээр shake + error haptic.
14. XP авах бүрт "+XP" floating toast + haptic (глобал helper).
15. Onboarding slide parallax/fade transition (эхний сэтгэгдэл).
16. Form validation inline + shake + error haptic (login/register).
17. `AppText`-руу нэгтгэх — quiz + бусад raw `Text` дэлгэц (S7).
18. Icon-only товчинд `accessibilityLabel` (a11y).

**🟨 Medium (consistency & polish):**
19. Бүх 46 static-color файлыг `useColors()`-руу шат дараалан шилжүүл (S4).
20. Streak flame pulse анимаци (Home).
21. Lesson map node → detail zoom/shared transition.
22. Lesson lock/unlock reveal + haptic.
23. Reading double-tap translate → sheet slide + haptic.
24. Reading scroll-linked progress bar.
25. Chat typing indicator + message fade-in.
26. Profile stat count-up.
27. Leaderboard rank stagger + top-3 glow.
28. `radius` нийцлийг компонент бүрт шалгаж нэгтгэ.
29. `EmptyState`-д fox mascot + дулаахан текст.
30. Modal (`EditProfileModal`, sheets) spring open/close + backdrop fade.
31. Pull-to-refresh дээр haptic + custom fox spinner.
32. Contrast audit — `textMuted` жижиг текст WCAG AA.
33. Dynamic font scale + layout тэсвэр шалгах.
34. word_match — drag&drop (gesture-handler) болгох.
35. Quiz progress bar анимацтай дүүргэлт.
36. Continue карт дээр жинхэнэ lesson thumbnail.
37. Task grid `23%` → responsive `gap`/2×2 tile.
38. Toast/snackbar дундын систем (одоо `Alert` ашигладаг эсэхийг шалга).
39. Loading state-үүдийг skeleton-оор нэгтгэ (profile, lessons, reading).
40. Button `secondary`/`ghost` variant-ийн press/disabled төлөв нэгтгэ.

**🟩 Low (nice-to-have delight):**
41. Fox idle blink/breathe loop анимаци.
42. Screen transition (expo-router) — fade/slide тохируулга.
43. Reduce Motion тохиргоог хүндэтгэх wrapper.
44. Quiz combo/streak-in-quiz заалт (Duolingo мэдрэмж).
45. Level progress ring (bar-аас ring руу).
46. Leaderboard өөрийн мөр sticky.
47. Sound effect (сонголттой) — зөв/буруу/XP.
48. Dark/light toggle-д зөөлөн cross-fade transition.
49. Achievement/badge unlock celebration modal.
50. App icon + splash + font (Onest/Inter) ачаалах (launch checklist-тэй давхцана).

---

## 7. Хэрэгжүүлэх дараалал (санал)

1. **7 хоног 1 — "Delight foundation":** #1–#8 (haptics helper, Button glow+theme,
   press spring, ProgressBar timing, tab haptic). Дундын код тул нэг PR олон
   дэлгэцийг зэрэг сайжруулна. **Хамгийн өндөр ROI.**
2. **7 хоног 2 — "Learning loop":** #4, #5, #11, #13, #14 (quiz instant feedback +
   celebration + XP toast). Gamification-ийн зүрх.
3. **7 хоног 3 — "Polish & consistency":** #9, #12, #15–#19 (skeleton, entrance,
   onboarding, AppText нэгтгэл, static-color migration эхлүүлэх).
4. **Тасралтгүй:** #19 (46-файлын theme migration) — жижиг PR-аар багаар (DESIGN.md
   workflow), shared component-оос эхэл.

> **Тэмдэглэл:** Mobile нь Choi/Boju хариуцдаг (CLAUDE.md). Энэ review нь **audit
> document** — хэрэгжүүлэлтийг тэдэнтэй зохицуулах; shared `theme.ts` /
> `components/` өөрчлөлт нь жижиг PR-аар (TEAM_WORKFLOW). Backend талын өгөгдөл
> (жинхэнэ progress/streak — S8, #10) нь Өсөхбаярын талын ажил.
