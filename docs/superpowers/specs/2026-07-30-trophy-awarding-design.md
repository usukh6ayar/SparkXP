# Трофей олгох логик — дизайн

> Огноо: 2026-07-30 · Эзэн: Өсөхбаяр (backend) · Төлөв: батлагдсан, хэрэгжүүлэхэд бэлэн

## 1. Асуудал

`catalog.ts`-д 100 трофей (10 tier) байгаа, зураг нь R2 дээр бэлэн, `GET /achievements`
нь тэдгээрийг `earned` тэмдэгтэйгээр буцаадаг. Гэвч **`User.trophies` руу код хаана ч
бичдэггүй** — өөрөөр хэлбэл трофей хэзээ ч нээгддэггүй. UI холбовол 100 трофей бүгд
мөнхөд түгжээтэй харагдана.

## 2. Хамрах хүрээ

**Энэ ажилд орох:** одоогийн өгөгдлөөр шалгаж болох **~70 трофейд** нөхцөл өгч,
олгох механизм, API, backfill бичих.

Аль трофей алинд орохыг **хэрэгжүүлэх төлөвлөгөөнд бүрэн жагсаана** — 100 мөрийн
нэрлэсэн зураглал энэ баримтад багтахгүй.

**Card трофейнууд орно.** Энэ кодын санд "card" = **swipe флашкарт**, өөрөөр хэлбэл
`WordReview` мөр (`word-review.entity.ts` тайлбар: *"Total times the user has seen
this card"*, *"Last swipe verdict"*). Тиймээс Card Starter → Legend цуврал нь
`words_saved` нөхцөлөөр шууд шалгагдана.

**Орохгүй** — өгөгдөл нь бүртгэгддэггүй ~30 трофей `condition: null` хэвээр үлдэж,
UI-д "удахгүй" гэж харагдана:

| Бүлэг | Яагаад одоо болохгүй вэ |
| --- | --- |
| A1/A2/B1/B2 Finisher | `user.level` бол бүртгэлд гараар сонгосон утга — ахиц дүгнэдэггүй |
| Grammar Master 1–4 | `quiz.category` чөлөөт текст, "grammar" ангилал тогтоогүй |
| Fluency Trial/Engine | Ярианы минутыг трофейд ашиглах эсэх шийдэгдээгүй |

Шинэ бүртгэл нэмэгдэх бүрт нөхцөлийг нь нэмнэ — архитектур үүнд бэлэн.

**Мобайлын UI энэ ажилд орохгүй** (Choi/Boju-гийн хэсэг). Backend нь `unseen`
жагсаалт өгнө, харуулах ажлыг тэд хийнэ.

## 3. Шийдвэрүүд

| # | Шийдвэр | Яагаад |
| --- | --- | --- |
| 1 | Боломжтой ~60-аар эхэлнэ | Үлдсэн 40 нь бүтээгдэхүүний шийдвэр шаардана; хүлээх шалтгаангүй |
| 2 | Нөхцөл кодод, өгөгдөл хэлбэрээр | Логик кодод, тоо нь өгөгдөл. Тестлэхэд амар, git-д түүхтэй |
| 3 | `award()`-ын дараа, эх сурвалжаар шүүж | Халуун зам хөндөгдөхгүй, шууд нээгдэнэ |
| 4 | `seen_at` тэмдэг + дараагийн дуудалт | Хэрэглэгч тус бүрийн мэдэгдлийн жагсаалт байхгүй (Notification нь broadcast) |
| 5 | Тусдаа `user_trophies` хүснэгт | Уралдааны нөхцөлөөс DB-ээр хамгаална — §4-ийг үз |
| 6 | Backfill, `seen_at = now()` | Түүх шударгаар тусна, 24 модал дараалахгүй |

## 4. Өгөгдлийн загвар

```ts
@Entity('user_trophies')
@Index(['userId', 'slug'], { unique: true })
export class UserTrophy extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar' })
  slug: string;

  /** null = баярлах цонхыг хараахан харуулаагүй. */
  @Column({ name: 'seen_at', type: 'timestamptz', nullable: true })
  seenAt: Date | null;
}
```

`BaseEntity`-гийн `created_at` = **авсан огноо** (тусад нь багана хэрэггүй).

**Яагаад jsonb биш вэ — уралдааны нөхцөл.** Шалгалт XP олгох бүрт хойшлуулж явна.
Хэрэглэгч сорил өгөөд зэрэг үг давтахад хоёр шалгалт зэрэг ажиллана. jsonb массив
дээр read-modify-write хийвэл нэг нь нөгөөгөө дарж **трофей алдагдана**. `UNIQUE`
индекс + `INSERT ... ON CONFLICT DO NOTHING` нь атомарх.

Нэмэлт ашиг: трофей бүрийн огноо → "сүүлд авсан" жагсаалт, ховор трофейн аналитик,
трофейн тоогоор чансаа — бүгд query-ээр гарна.

`User.trophies` (jsonb) багана **хэрэглээгүй үлдэнэ**. Устгах нь тусдаа цэвэрлэх
PR-ын ажил — энэ PR-ыг томруулахгүй.

**Migration:** `CreateUserTrophies` — хүснэгт + unique индекс. `DB_SYNCHRONIZE=false`
тул prod дээр migration заавал.

## 5. Нөхцөлийн схем

```ts
export type TrophyCondition =
  | { type: 'xp_total';       value: number }              // user.xp
  | { type: 'sparks_total';   value: number }              // user.sparks
  | { type: 'streak_days';    value: number }              // user.longestStreak
  | { type: 'xp_events';      source: XpSource; value: number }
  | { type: 'quiz_perfect';   value: number }              // quiz_attempts.score_pct = 100
  | { type: 'words_saved';    value: number }              // word_reviews.saved = true
  | { type: 'words_mastered'; value: number }              // word_reviews.recall_status = 'know'
  | { type: 'buddy_distinct'; value: number };             // distinct buddy_sessions.buddy_slug
```

`xp_events` нь эх сурвалж параметртэй тул `quiz_count` · `lesson_count` ·
`reading_count` · `review_count` гэсэн 4 төрлийг нэг болгож байна.

Каталогт:

```ts
{ slug: 'starter_first_quiz', tier: 'starter', name: 'First Quiz',
  condition: { type: 'xp_events', source: XpSource.QUIZ, value: 1 } }

{ slug: 'gold_a1_finisher', tier: 'gold', name: 'A1 Finisher',
  condition: null }   // өгөгдөл бүртгэгддэггүй → UI-д "удахгүй"
```

### Босго тоонууд

Босгыг **tier-ийн шатлалаар** тавина (starter хамгийн хялбар → celestial хамгийн хүнд).
Жишээ `xp_total`: 100 · 500 · 1k · 5k · 10k · 25k · 50k · 100k · 500k · 10M.

Хамгийн дээд tier-үүдийн зурган дээр нөхцөл нь **бичээстэй** байдаг тул тэднийг
дагана — жишээ нь `celestial_the_eternal_spark` = *"Earn 10,000,000 XP and unlock 99
trophies"*, `mythic_ai_circle_master` = *"5 different AI Buddies, 50 conversations each"*.
Доод tier-үүдэд зурган дээр нөхцөл байхгүй тул тоог шатлалаас гаргана.

> Тоонууд бол **санал**, нэг мөрийн өгөгдлийн засвар. Бүтээгдэхүүний мэдрэмжээр
> чөлөөтэй тохируулна — хэрэгжүүлэлт хойшлуулах шалтгаан биш.

## 6. Үнэлэх урсгал

```
XpService.award({ userId, source })
   │
   ├─ XP бичигдэж, хариу шууд буцна            ← халуун зам хөндөгдөхгүй
   │
   └─ void trophies.checkAfterXp(userId, source)      (fire-and-forget)
        │
        ├─ CONDITION_TYPES_BY_SOURCE[source] → холбогдох нөхцөлийн төрлүүд
        ├─ каталогоос: тэр төрөлтэй ∧ хараахан аваагүй трофей
        │     └─ хоосон бол ШУУД ГАРНА (query огт үүсэхгүй)
        ├─ зөвхөн хэрэгтэй статистикийг ачаална (1–2 aggregate query)
        └─ хангасныг INSERT ... ON CONFLICT DO NOTHING
```

Жишээ: `XpSource.QUIZ` → `xp_events(QUIZ)` ба `quiz_perfect` хоёр төрөл хамаарна →
~8 трофей → 2 query.

**Алдаа гаргахгүй.** `checkAfterXp` доторх бүх алдааг барьж, лог бичээд залгина —
трофейн алдаанаас болж XP олголт эсвэл хэрэглэгчийн үйлдэл унах ёсгүй.

**Файлын хуваарилалт** (тус бүр нэг зорилготой):

| Файл | Үүрэг |
| --- | --- |
| `achievements/conditions.ts` | `TrophyCondition` төрөл, `CONDITION_TYPES_BY_SOURCE`, цэвэр үнэлэгч функцүүд |
| `achievements/trophy-stats.service.ts` | Статистикийг DB-ээс уншина (зөвхөн хэрэгтэйг) |
| `achievements/achievements.service.ts` | Одоогийнх + `checkAfterXp`, `markSeen` |
| `achievements/catalog.ts` | Одоогийнх + `condition` талбар |

Үнэлэгч нь **цэвэр функц** (`stats` объект → boolean) тул DB-гүйгээр тестлэнэ.

## 7. API

| Endpoint | Өөрчлөлт |
| --- | --- |
| `GET /achievements` | Одоогийн хэлбэр + трофей бүрт `earnedAt`, хариунд `unseen: string[]` |
| `POST /achievements/seen` | Үзсэн гэж тэмдэглэнэ. Body `{ slugs?: string[] }` — хоосон бол бүгд |

`API.md`-г шинэчилнэ (CLAUDE.md-ийн дүрэм).

## 8. Backfill

`backend/src/scripts/backfill-trophies.ts`:

```
бүх хэрэглэгч × нөхцөлтэй бүх трофей
  → хангасныг INSERT (seen_at = now())    ← чимээгүй, модал гарахгүй
  → --dry-run: хэдэн трофей олгогдохыг харуулна, юу ч бичихгүй
```

Deploy-ийн дараа нэг удаа. Түүнээс хойш нээгдсэн трофей л `seen_at = null` болж
баярлах цонх гаргана. Идемпотент (`ON CONFLICT DO NOTHING`) тул дахин ажиллуулж болно.

Prod-д одоо 5 тест бүртгэл байна (`admin` 1,540 XP, `bagsh` 460 XP) — эдгээр нь
backfill болон нөхцөлүүдийг шалгах бодит материал.

## 9. Тест

| Түвшин | Юуг |
| --- | --- |
| Unit (`conditions.spec.ts`) | Үнэлэгч бүр: босгоос доош/яг дээр/дээш. Цэвэр функц, DB хэрэггүй |
| Unit | `CONDITION_TYPES_BY_SOURCE` — нөхцөлийн төрөл бүр ядаж нэг эх сурвалжид харьяалагдана (үгүй бол трофей хэзээ ч шалгагдахгүй) |
| Unit | Каталогийн бүрэн бүтэн байдал: `condition` бүхий бүх трофейн `type` нь үнэлэгчтэй таарна |
| Integration | Хоёр `checkAfterXp` зэрэг дуудахад трофей давхардахгүй (`ON CONFLICT`) |

`gamification.spec.ts` -ийн одоогийн загварыг дагана.

## 10. Эрсдэл

| Эрсдэл | Хамгаалалт |
| --- | --- |
| Трофей алдагдах (уралдаан) | DB unique + `ON CONFLICT` |
| XP олголт унах | `checkAfterXp` бүх алдааг залгина |
| DB ачаалал өснө | Эх сурвалжаар шүүнэ; аваагүй трофей байхгүй бол query огт үүсэхгүй |
| Босго буруу тохирох | Нэг мөрийн өгөгдлийн засвар; backfill дахин ажиллуулна |
