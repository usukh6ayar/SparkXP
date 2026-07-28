# BE хүсэлт (Choi → Өсөхбаяр): streak freeze-ийн үнэ + дээд хязгаарыг API-аар өгөх

**Огноо:** 2026-07-28 · **Хэмжээ:** ~3 мөр · **Файл:** `backend/src/xp/xp.service.ts`

## Асуудал

`GET /gamification` нь `streakFreezes` (эзэмшиж буй тоо) буцаадаг ч **үнэ болон
дээд хязгаарыг буцаадаггүй**. Гэтэл үнэ нь багцаас хамаардаг:

```ts
// xp.service.ts
const cost = activePlan?.streakFreezeSparks ?? STREAK_FREEZE_SPARKS; // 100
if (held >= MAX_HELD_FREEZES) { ... }                                // 2
```

Тиймээс mobile тал үнийг **таамаглахаас** өөр аргагүй. Хэрэв би `100` гэж
hardcode хийвэл admin `plans.streak_freeze_sparks`-ыг өөрчилсөн даруйд апп
**буруу үнэ харуулна** — энэ нь CLAUDE.md-ийн үндсэн дүрмийг зөрчинө:

> Plan limits (voice minutes, tokens, Sparks rate) must be configurable
> from admin/DB **without an app update**.

Зүрхний хэсэгт үүнийг **аль хэдийн зөв хийсэн** байгаа — `HeartsState` нь
`refillCost` болон `max`-ыг өгдөг. Streak freeze дээр л дутуу байна.

## Хүсэлт

`getGamification()`-ийн буцаах объектод 2 талбар нэмэх:

```ts
return {
  ...
  streakFreezes: user?.streakFreezes ?? 0,
  streakFreezeCost: activePlan?.streakFreezeSparks ?? STREAK_FREEZE_SPARKS,
  maxStreakFreezes: MAX_HELD_FREEZES,
  ...
};
```

`buyStreakFreeze()` дотор багц шийдэх логик аль хэдийн байгаа тул түүнийг
`getGamification()`-д хуваалцаж болно (DRY).

Migration шаардлагагүй — зөвхөн хариунд нэмэгдэнэ.

## Mobile тал юу хийсэн бэ (одоо блоклогдоогүй)

`Gamification` төрөлд хоёуланг нь **optional** гэж тодорхойлсон
(`mobile/src/api/gamification.ts`). Ирвэл шууд хэрэглэнэ; ирээгүй үед
`STREAK_FREEZE_FALLBACK = { cost: 100, max: 2 }` руу унана.

Өнөөдөр `plans.streak_freeze_sparks` нь бүх багцад `NULL`
(`AddStreakFreezeAndXpIndex1786000000000` migration үүнийг seed хийдэггүй)
тул fallback нь **бүх хэрэглэгчид зөв**. Гэхдээ admin эхний удаа үнэ
тохируулсан мөчид чимээгүйхэн буруу болно — тиймээс тэрнээс өмнө засах нь зүйтэй.

## Шалгах

`GET /gamification` хариунд `streakFreezeCost` гарч ирвэл mobile талд
өөрчлөлт хийх шаардлагагүй — optional талбар тул автоматаар хэрэглэгдэнэ.
