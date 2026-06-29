# EnglishXP — Багийн ажлын урсгал (code давхцлаас сэргийлэх)

> Зорилго: **4 dev зэрэг ажиллахад код давхцахгүй, merge conflict бага байх.**
> Гол санаа: **хүн бүр зөвхөн өөрийн талбайн файлыг засна.** Хуваалцсан файлыг
> зөвхөн "зарлаад → жижиг PR → хурдан merge" журмаар хүрнэ.
> Багийн бүтэц: `CLAUDE.md` → "Work division". Mobile дэлгэц: `MOBILE_ROADMAP.md`.

---

## 1. Хэн юу эзэмших вэ (ownership)

| Dev | Branch | Зөвхөн энэ хавтсыг засна |
| --- | --- | --- |
| **Усухбаяр** (lead) | `usukhbayar` | `/admin` |
| **Bishrelt** | `bishrelt` | `/backend` |
| **Choi** | `choi` | `/mobile` — сурах цөм (доорх файлууд) |
| **Boju** | `boju` | `/mobile` — тоглоом/сошл (доорх файлууд) |

**Дүрэм:** өөрийн биш хавтсын файлыг **бүү зас**. Хэрэгтэй бол эзэмшигчид хэл.

### Mobile дотор Choi ↔ Boju хуваалт (route файлаар)

**Choi — сурах цөм:**
```
mobile/app/(auth)/onboarding.tsx · login.tsx · register.tsx · forgot.tsx
mobile/app/(tabs)/index.tsx        (Home)
mobile/app/(tabs)/lessons.tsx
mobile/app/lesson/[id].tsx
mobile/app/review.tsx
mobile/app/swipe.tsx · saved.tsx
```

**Boju — тоглоом/сошл:**
```
mobile/app/quiz/[id].tsx · vocab-quiz.tsx
mobile/app/(tabs)/soril.tsx · chat.tsx · profile.tsx
mobile/app/leaderboard.tsx
mobile/app/avatar.tsx · assignments.tsx
mobile/app/(teacher)/*
mobile/app/join/*
```

---

## 2. Хуваалцсан файлууд (conflict-ийн гол эх үүсвэр) — ЗАРЛАГАД

Эдгээрийг **2 хүн зэрэг бүү засаарай.** Засах бол: чатад зарла → жижиг PR →
тэр өдөртөө merge. Том өөрчлөлт бол эхлээд бусдад мэдэгд.

**Mobile (Choi ↔ Boju хуваалцана):**
- `mobile/src/theme/theme.ts` — өнгө/spacing/type токен
- `mobile/src/components/*` — дахин ашиглагдах UI (Button, TextField г.м.)
- `mobile/src/i18n/*` — текст
- `mobile/src/api/client.ts` — fetch wrapper
- `mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx` — навигаци/tab bar
- `mobile/app/(teacher)/_layout.tsx`

**Backend (Bishrelt эзэмшинэ):** mobile/admin хүн backend-ийг **шууд бүү зас.**
Endpoint хэрэгтэй бол Bishrelt-д хэл → тэр нэмж `API.md` шинэчилнэ. Энэ нь
`entities/`, `enums`, module-уудыг 2 хүн зэрэг засахаас сэргийлнэ.

**Бичиг баримт (баг даяар):** `API.md`, `CLAUDE.md`, `*ROADMAP.md` — жижиг,
зорилтот засвараар л хүр. Их хэмжээний форматчлал бүү хий.

---

## 3. Шинэ дахин ашиглагдах хэрэгслийг хэн нэмэх вэ

Нэг л component/helper-ийг 2 хүн давхар бичихээс сэргийлэх:
- Mobile shared component (жишээ нь шинэ `Card`, `Chip`) хэрэгтэй бол → чатад
  "би X component-ийг `src/components`-д нэмж байна" гэж зарлаад, ганц PR-аар оруул.
- Аль хэдийн байгаа эсэхийг эхлээд `mobile/src/components/`-оос **хайж үз.**
- Хуулж тавихын оронд **дахин ашигла** (DRY — `CLAUDE.md` дүрэм).

---

## 4. Backend endpoint хүсэх урсгал (mobile → Bishrelt)

1. Mobile dev хэрэгтэй endpoint-оо тодорхой бичнэ: зам, метод, оролт/гаралт,
   auth level. (GitHub issue эсвэл чат.)
2. Bishrelt `/backend`-д нэмж, `API.md`-г шинэчилж, `bishrelt` branch-аас PR.
3. Merge болсны дараа mobile dev `mobile/src/api/`-аар дамжуулж дуудна
   (screen дотор raw `fetch` бүү бич — `CLAUDE.md` дүрэм).

Ингэснээр backend-ийн entity/module-ийг ганц хүн (Bishrelt) удирдана →
schema давхцал, дахин ажил гарахгүй.

---

## 5. Git урсгал (өдөр бүр)

```bash
# 1) Ажил эхлэхийн ӨМНӨ заавал — бусдын merge хийсэн ажлыг ав
git checkout main && git pull origin main
git checkout <миний-branch> && git merge main

# 2) Ажиллаад, жижиг commit-уудаар
git add -p && git commit -m "..."

# 3) Push → PR нээ → нөгөө dev review → main-д merge
git push origin <миний-branch>
```

- `main` үргэлж ажиллагаатай. **`main`-д шууд бүү push.**
- **Жижиг, олон PR.** Нэг PR = нэг дэлгэц/нэг feature. Том PR = том conflict.
- PR-ийг нөгөө dev (эсвэл lead) review хийгээд merge.
- `.env` хэзээ ч commit хийхгүй. Шинэ config key нэмбэл `.env.example`-д бич.

---

## 6. Conflict-ээс сэргийлэх 7 алт дүрэм (TL;DR)

1. **Өдөр бүр эхлэхдээ `main`-ийг pull + merge** хий.
2. **Зөвхөн өөрийн талбайн файлыг зас** (хүснэгт §1).
3. **Хуваалцсан файлыг (§2) зарлаад, жижиг PR-аар, хурдан merge.**
4. **Backend-ийг зөвхөн Bishrelt зас**; бусад нь endpoint хүсэлт тавина.
5. **Жижиг, олон PR** — нэг feature тутамд нэг PR.
6. **Эзэмшээгүй файлаа reformat/refactor бүү хий** (conflict дэмий ихэснэ).
7. **Хуваалцсан backend/auth/navigation өөрчлөлтийг чанга зарла** (`CLAUDE.md`-д тэмдэглэ).
