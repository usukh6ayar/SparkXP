# Streak баяр хүргэлт + Профайлд онцолсон трофей (design)

Огноо: 2026-07-31 · Салбар: `usukhbayar`

Хоёр жижиг feature, аль аль нь одоо байгаа трофейн дэд бүтцийг дахин ашиглана.

---

## 1. Streak баяр хүргэлт

**Асуудал.** Өдрийн зорилго биелж streak урагшлахад XP урамшуулал чимээгүй
нэмэгддэг — хэрэглэгч мэдэхгүй өнгөрдөг. Трофей нээгдэхэд гардаг шиг
баяр хүргэлт харуулъя.

**Хаана хадгалах вэ.** "Streak өнөөдөр урагшилсан" гэдэг баримт аль хэдийн
`users.last_active_date === өнөөдөр` дотор байгаа. Тиймээс зөвхөн
**"харуулсан уу"** гэдгийг л хадгалах хэрэгтэй → Redis түлхүүр
`streak:seen:{userId} = <dayKey>` (TTL 48ц). Prod дээр `DB_SYNCHRONIZE=false`
тул багана нэмэхээс зайлсхийв (Redis нь аль хэдийн заавал байх хамаарал).
Redis уншиж чадаагүй үед `null` буцаана — модал давтагдахаас илүү нэг удаа
алдсан нь дээр.

**Backend**
- `GamificationSummary.streakCelebration: { streak, bonusXp } | null`
  — `lastActiveDate === today && seen !== today` үед л утгатай.
  `bonusXp` нь `streakXp(streak, rewards)` (Redis-ээс тохируулагддаг тул
  хатуу бичихгүй).
- `POST /gamification/streak-seen` → seen тэмдэглэнэ.

**Mobile**
- `AchievementModal` дээр нэмэлт `overline` талбар (трофейн
  "Шинэ амжилт нээгдлээ!" гэсэн текст streak-д тохирохгүй).
- Streak модал: гал дүрс + улбар шар tint + `{n} өдрийн цуваа!` +
  `+{n} XP урамшуулал`.
- **Дараалал:** трофей ба streak хоёр нэг queue-д орно, **streak эхэлж**,
  дараа нь трофей (хэрэглэгчийн сонголт). Тиймээс нэг host, нэг queue.
- `useUnseenTrophies` → `useCelebrations`, `TrophyHost` → `CelebrationHost`,
  `checkTrophies()` → `checkCelebrations()`. `/gamification`-г SWR кэшээс
  бус шинээр татна, dismiss хийсний дараа `handled` ref-ээр давхардлыг хаана.

## 2. Профайлд трофей онцлох (pin, max 5)

**Backend**
- `user_trophies.pinned_rank smallint null` (0..4, null = онцлоогүй)
  + migration. Зөвхөн авсан трофейг л онцолж болно (тухайн мөр байхгүй бол
  онцлох боломжгүй — өгөгдлийн загвар өөрөө хамгаалж байна).
- `GET /achievements` → `pinned: string[]` (rank-аар эрэмбэлсэн).
- `PUT /achievements/pinned` `{ slugs: string[] }` — бүх багцыг солино
  (≤5, бүгд авсан байх ёстой), нэг transaction дотор эхлээд бүгдийг
  цэвэрлээд index-ээр rank онооно.

**Mobile**
- `/trophies` дэлгэрэнгүй sheet дээр "Профайлд онцлох / Болих" товч.
  5 хүрсэн байхад шинээр онцлох гэвэл toast-оор сануулна.
- Профайл дээрх одоогийн "Миний амжилтууд" мөр нь **онцолсныг** харуулна;
  онцлоогүй бол одоогийн зан төлөв (сүүлд авсан/түгжээтэй) хэвээр.

## Тест
- Backend: `streakXp` дээр тулгуурласан `streakCelebration` логик +
  `setPinned` (5-аас их, аваагүй трофей) unit тест.
- Mobile: `tsc --noEmit`.
