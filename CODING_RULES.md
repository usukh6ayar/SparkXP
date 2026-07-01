# SparkXP — Code бичих дүрэм (заавал мөрдөх)

> **Энэ файлыг код бичих/засахын ӨМНӨ заавал уншина** (Claude болон хүн хоёулаа).
> Гол зарчим: **бага код · дахин ашиглалт (DRY) · component/service суурьтай ·
> junior уншиж ойлгохоор.** `CLAUDE.md`-ийн Code Conventions-ийг өргөтгөсөн бодит дүрэм.

---

## 0. Алтан 4 дүрэм

1. **Less code** — асуудлыг хамгийн цөөн мөрөөр шийд. Код нэмэхээсээ өмнө "энэ
   заавал хэрэгтэй юу, байгаа зүйлээ ашиглаж болох уу?" гэж асуу.
2. **DRY** — ижил UI/логик 2 дахин гарвал ЗААВАЛ нэг дор гарган ав (component /
   hook / helper / service). Copy-paste = алдаа.
3. **Component / service суурьтай** — дэлгэц/endpoint нь жижиг, дахин ашиглагдах
   хэсгүүдийг **угсарна**, шинээр style/логик тодорхойлохгүй.
4. **Readable** — junior dev уншаад ойлгохоор. Тодорхой нэр, жижиг функц,
   ойлгомжгүй логикт л комментлэ.

---

## 1. Шинэ код бичихээс өмнө (заавал)

- [ ] Ижил төстэй зүйл **аль хэдийн байгаа эсэхийг хай** (`components/`, `api/`,
      `theme/`, backend service/helper). Байвал түүнийг ашигла/өргөтгө.
- [ ] Ижил логик 2+ газар давтагдах бол → нэг дор гаргаж ав.
- [ ] Файл хэт томрох (≈300+ мөр) бол хэсэгчилж салга.
- [ ] `main` pull хийсэн, өөрийн branch дээр ажиллаж байгаа эсэхээ шалга (`CLAUDE.md` git rules).

## 2. Mobile (`/mobile`) дүрэм

- **Component нэг л удаа бич.** Дахин ашиглагдах UI → `mobile/src/components/`
  (жишээ: `Button`, `TextField`, `SelectField`, `TopBar`, `AppText` (Text),
  `Card`, `ProgressBar`, `Loading`, `CategoryBrowser`). Дэлгэц ≈ component угсралт.
- **Hardcoded өнгө/hex хориотой.** Бүх өнгө/зай/радиус `mobile/src/theme/theme.ts`-ээс
  (`colors/spacing/radius/tints`). Dark/light дэмжихийн тулд **`useColors()`** +
  `makeStyles(c)` загвар ашигла (жишээ: `CategoryBrowser.tsx`, `skill/[key].tsx`).
- **Hardcoded текст хориотой.** Хэрэглэгчид харагдах бичвэр `mobile/src/i18n`-аас
  (монгол эхэнд). (Тэмдэглэл: одоо зарим экран шууд монгол стринг агуулдаг —
  шинэ кодод i18n-ийг баримтал.)
- **Raw `fetch` хориотой.** Бүх API дуудлага `mobile/src/api/` дундуур
  (`client.ts` → `apiRequest`/`apiUpload`). Screen дотор `fetch` бичихгүй.
- **2 түвшний сэдэв → item жагсаалт** хэрэгтэй бол `CategoryBrowser`-ийг дахин ашигла.
- **StyleSheet** нэг л удаа (`makeStyles` эсвэл module-level `StyleSheet.create`);
  inline style-ийг зөвхөн жижиг динамик утганд.

## 3. Backend (`/backend`) дүрэм

- **Feature = module folder** (`*.module.ts` / `*.controller.ts` / `*.service.ts` /
  `dto/`), `app.module.ts`-д бүртгэ.
- **Бизнес логик service дотор.** Controller зөвхөн route + guard + DTO. Логикийг
  controller-т бүү бич.
- **Орж ирэх бүх өгөгдөл DTO + class-validator-оор** шалга (`@IsString`, `@IsInt`,
  `@IsOptional`, `@ValidateNested` г.м.). Түүхий `any` body хориотой.
- **Entity дүрэм** (`CLAUDE.md` Core Rules): UUID PK (`BaseEntity`),
  `created_at/updated_at`, уян хатан агуулга → `jsonb`, `@ManyToOne`-д заавал
  `@JoinColumn({ name })`, nullable string-д тодорхой `type`.
- **AI дуудлага бүр AI Gateway дундуур** (per-user limit, log, cost). Feature-ээс
  AI API-г шууд бүү дууд.
- **Limit/тохиргоо** (voice/token/Sparks) admin/DB-ээс config — апп шинэчлэлгүйгээр.
- **Prod migration:** шинэ багана/table нэмбэл `src/migrations/`-д migration бич
  (prod `DB_SYNCHRONIZE=false`). Загвар: `AddQuizTopic`, `AddReadingComprehensionQuestions`.
- **Content DB-д** — үг/хичээл/quiz-ийг hardcode хийхгүй, admin-аас нэмдэг байх.

## 4. Admin (`/admin`) дүрэм

- **Дундын component ашигла:** `Button`, `Input`, `Select`, `Table`, `Modal`,
  `Pagination`, `FormActions`, `RowActions`, `PageHeader`, `Badge`. Шинэ table/form
  бүрд эдгээрийг угсар, шинээр бүү зохио.
- **Давтагдах editor → дундын component** (жишээ: `QuizQuestionsEditor`,
  `ImageCropUpload`). Асуулт/медиа editor-ийг хуулбарлахгүй.
- **API зөвхөн `api.get/post/patch/delete`** (`admin/src/api/client.ts`) дундуур
  (token автоматаар залгагдана). Raw `fetch` хориотой.
- **Санал/сонголтын жагсаалт** `admin/src/lib/options.ts`-д (жишээ:
  `levelFormOptions`, `readingCategoryOptions`, `exerciseCategoryOptions`) — page
  бүрд дахин бүү тунхагла.

## 5. Хориглох (anti-patterns)

- ❌ Copy-paste хийсэн UI/логик (→ component/helper болго).
- ❌ Screen/controller дотор давтагдсан том блок.
- ❌ Hardcoded hex өнгө, hardcoded хэрэглэгчийн текст, raw `fetch`.
- ❌ Controller дотор бизнес логик; DTO-гүй body.
- ❌ Нэг файлд хэт олон хариуцлага (God component/service).
- ❌ Ашиглагдахгүй код/import үлдээх (устга).

## 6. Commit-ийн өмнөх checklist

- [ ] Давхардсан код байхгүй (DRY).
- [ ] Дэлгэц/endpoint нь байгаа component/service-ийг ашигласан.
- [ ] Өнгө/текст/api = theme/i18n/client дундуур.
- [ ] Backend: DTO баталгаажуулалт + (шаардвал) migration.
- [ ] `tsc --noEmit` цэвэр; ашиглагдахгүй код цэвэрлэсэн.
- [ ] Файл хэт том биш; нэр ойлгомжтой.

---

## 7. PROMPT — одоо байгаа кодыг энэ дүрэмд оруулах

> Дараах prompt-ыг Claude session-д хуулж өгвөл байгаа кодыг дүрэмд нийцүүлж
> refactor хийнэ. **Нэг талбар (mobile/admin/backend) тус бүрээр** тусад нь
> ажиллуул (жижиг PR болгохын тулд).

```
CODING_RULES.md-г эхлээд бүрэн унш. Дараа нь <ЗАМ> доторх кодыг энэ дүрэмд
нийцүүлэн refactor хий. Зорилго: зан төлөвийг ӨӨРЧЛӨХГҮЙгээр DRY / less code /
component-based болгох.

Алхам:
1. Аудит: дараах зөрчлүүдийг ол, жагсаалт гарга (файл:мөр + асуудал):
   - давхардсан UI/логик (copy-paste) → гаргаж авах боломжтой хэсгүүд
   - hardcoded hex өнгө (theme-д байхад), hardcoded хэрэглэгчийн текст (i18n-д байх ёстой)
   - raw fetch (client-ийг ашиглах ёстой)
   - хэт том файл/component/service (салгах боломжтой)
   - backend: controller дотор логик, DTO-гүй body, migration дутуу
2. Аудитыг эрэмбэл: (a) өндөр давхардал/эрсдэл багатай → эхэлж; (b) томоохон
   бүтцийн өөрчлөлт → тусад нь.
3. Refactor хийхдээ:
   - Байгаа component/helper/theme/i18n/client-ийг ЭХЛЭЭД ашигла; шинийг зөвхөн
     дахин ашиглагдах бол үүсгэ (`components/` эсвэл shared service/helper).
   - Нэг удаад нэг сэдэв (нэг давхардлыг арилгах г.м.) — жижиг, шалгаж болохоор.
   - Public API / зан төлөв хэвээр. Тест/`tsc --noEmit` цэвэр байлга.
4. Бүрд нь: юу өөрчилснөө, аль дүрэмд нийцүүлснийг товч тайлбарла.

Хязгаар: нэг ажиллагаанд зөвхөн <ЗАМ>-ын хүрээнд ажилла. Томоор бичихээс
зайлсхий — код ЦӨӨРӨХ ёстой. Эргэлзвэл асуу.
```

Жишээ `<ЗАМ>`: `mobile/app/(tabs)` · `mobile/src/components` · `admin/src/pages/words`
· `backend/src/reading`. Бүх repo-г нэг дор бүү refactor хий — талбараар нь хэсэгчил.
