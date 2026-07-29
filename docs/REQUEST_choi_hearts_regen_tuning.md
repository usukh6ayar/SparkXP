# BE хүсэлт (Choi → Өсөхбаяр): зүрхний сэргэх хугацааг тохируулдаг болгох

**Огноо:** 2026-07-29 · **Файл:** `backend/src/hearts/hearts.service.ts`

## Хүсэлт (яаралтай, тест хийхэд)

Зүрх **4 цаг тутам нэг** сэргэдэг нь тест хийхэд хэт удаан. Одоохондоо
**5 минут** болгож өгнө үү. Дараа нь бодит утга руу нь өсгөнө.

```ts
const DEFAULTS = {
  maxHearts: 5,
  regenMinutes: 5,   // 240 → 5 (түр зуур, тест хийх хугацаанд)
  refillSparks: 50,
};
```

## Илэрсэн гол цоорхой

`DEFAULTS` дээрх тайлбар нь *«Plan columns override these so the economy is
tunable from admin without shipping an app update»* гэж бичсэн байна. **Гэвч
бодит байдал тийм биш:**

- `/backend`-д **`plans` модуль байхгүй** (`src/plans/` алга) → багц үүсгэх/засах
  endpoint байхгүй
- **Admin-д багцын хуудас байхгүй** (`admin/src/pages/`-д `plans` алга)
- `heart_regen_minutes` · `max_hearts` · `heart_refill_sparks` ·
  `unlimited_hearts` · `streak_freeze_sparks` баганууд бий боловч **тэдгээрийг
  бөглөх ямар ч интерфейс байхгүй**
- Багцгүй (free) хэрэглэгч нь `activePlan = null` тул **үргэлж хатуу бичсэн
  `DEFAULTS`-ыг авна** — багцын багана нь түүнд огт хамаагүй

Өөрөөр хэлбэл зүрхний эдийн засгийг өөрчлөх цорын ганц арга нь **код засаад
дахин deploy хийх** — CLAUDE.md-ийн үндсэн дүрэмтэй зөрчилдөж байна:

> Plan limits (voice minutes, tokens, Sparks rate) must be configurable
> from admin/DB **without an app update**.

## Санал болгож буй бат шийдэл

AI limits дээр аль хэдийн ашигладаг **Redis runtime blob**-ийн хэв маягийг
давтах (`ai-gateway.service.ts:231` — `ai:limits:default`):

```ts
// ai:limits:default-тэй ижил зарчим
const raw = await this.redis.get('hearts:defaults');
const cfg = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
```

Ингэвэл deploy хийхгүйгээр `redis-cli set hearts:defaults '{"regenMinutes":5}'`
гэж шууд тааруулна. Тест хийх хугацаанд 5 минут, дараа нь 60 эсвэл 240 —
код хөндөхгүй.

Env var (`HEARTS_REGEN_MINUTES`) бол хамгийн бага хувилбар — Railway дээр
restart шаардах ч код засах шаардлагагүй.

## Mobile тал

Юу ч хийх шаардлагагүй. `HeartsState.nextHeartAt` / `fullAt`-ыг server
тооцоолж өгдөг тул утга өөрчлөгдмөгц тоолуур автоматаар шинэ хугацаагаар
явна. Апп шинэчлэх хэрэггүй.
