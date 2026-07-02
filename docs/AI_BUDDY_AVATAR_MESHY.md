# AI Buddy — 3D Avatar (Meshy → GLB) үүсгэх заавар

> **Зорилго:** SparkXP-ийн үнэг mascot-оос **rigged + animated GLB** 3D модель
> гаргаж, mobile апп-д (React Native + three.js) харуулж, амьд болгох.
> **Part 4 / V1** (гараар хийх дизайн ажил) — код биш. Дууссаны дараа
> `BuddyAvatar.tsx` (V2) энэ GLB-г дуудна.
>
> **Хамаарал:** backend аль хэдийн `ai_buddies.avatarAssetUrl` (GLB URL) +
> `avatarThumbUrl` + `emotionMap` (emotion/gesture tag → animation clip нэр)
> талбартай. Энэ GLB бэлэн болмогц admin панелаас (`/buddy` хуудас) тэдгээрийг
> бөглөнө. Одоо апп **2D зураг (fallback)**-аар ажиллаж байгаа тул яараад
> хэрэггүй — энэ бол визуал upgrade.

---

## 0. Юу гаргах ёстой вэ (эцсийн шаардлага)

Meshy-гээс гарах GLB нь дараах шаардлага хангасан байх ёстой:

| Шаардлага | Утга | Яагаад |
|---|---|---|
| Формат | **GLB** (glTF 2.0 binary, single file) | three.js/`useGLTF` native уншина |
| Хэмжээ | **< 5 MB** | Mobile татах/санах ой |
| Texture | **≤ 1024×1024** | Гар утасны FPS |
| Rig | Auto-rigged (humanoid/biped), **A-pose** | Animation тоглуулах |
| Animation | Дор хаяж **idle** (давталттай) + emotion/gesture clip-үүд | Turn бүрт эмоц солих |
| Lip-sync | **`mouth_open` morph target** ЭСВЭЛ jaw bone | Audio amplitude-аар ам хөдөлгөх |
| Thumbnail | Тусдаа **PNG** (нүүрэн талын зураг) | Buddy сонголтын жижиг зураг |

---

## 1. Бэлтгэл — оролтын зураг (5 мин)

Meshy-гийн **Image-to-3D** нь текстээс илүү тогтвортой, mascot-ийн онцлогийг
хадгална. Тиймээс зургаар оруулна.

1. SparkXP үнэг mascot-ийн **цэвэр, нүүрэн талын** зургийг бэлд
   (`mobile/assets/buddy-menu.png` эсвэл эх дизайн файлаас).
2. Дүрмүүд:
   - **Дэвсгэр цагаан/тунгалаг** (background арилгасан) — Meshy сегментчилэхэд амар.
   - Бүтэн бие харагдсан (толгой + бие + мөч), front view.
   - Нэг л дүр (олон объект байхгүй).
   - Хэрэв зөвхөн толгойн зураг байгаа бол Meshy-гийн текст prompt-оор
     "full body cute fox mascot, standing, front view" гэж нэмж болно.

---

## 2. Image-to-3D үүсгэх (Meshy 6) (~2–5 мин, credit зарцуулна)

1. [meshy.ai](https://www.meshy.ai) → бүртгэл (эхэн credit үнэгүй; илүү ихийг
   төлбөртэй авна). **Image to 3D** горим сонго.
2. Зургаа upload хий. Тохиргоо:
   - **Model version: Meshy 6** (хамгийн сүүлийн, чанар өндөр).
   - **Topology: Quad** (rig/animation-д ээлтэй).
   - **Target polycount: Low / ~10k–30k** (mobile — бага polygon).
   - **Texture: On, 1024px, PBR.**
   - **Symmetry: Auto/On** (mascot тэгш хэмтэй).
3. Generate → 4 хувилбар гарна. Нүүрнээс сайхан, mascot-тай төстэйг сонго.
   Таарахгүй бол зургаа сайжруулж (background цэвэрлэх) дахин оролд.
4. Хэрэгтэй бол **Retexture** / prompt-оор өнгө засах ("orange fox, purple
   SparkXP hoodie" гэх мэт).

> 💡 **Зөвлөгөө:** эхний хувилбар төгс байх албагүй. Rig + animation-д тохирсон,
> нүүр нь танигдахуйц бол хангалттай. Polygon бага байх тусам гар утсанд гөлгөр.

---

## 3. Optimize / Remesh (шаардлагатай бол)

GLB том гарвал (>5MB) багасга:
- Meshy дотор **Remesh → Low poly** дахин ажиллуул, target polycount бууруул.
- Texture-г **1024px** болго (2048 хэрэггүй).
- Export үед **Draco compression** асаа (доор §6).

---

## 4. Auto-Rig (~30 сек)

1. Загвараа сонгоод **Animate → Rig** (эсвэл "Auto-Rig").
2. **Rig type: Humanoid / Biped** (хоёр хөл, хоёр гар, толгой).
3. **Pose: A-pose** сонго (animation library-тэй тохирно).
4. Meshy автоматаар skeleton + skinning weights тооцно (~30 сек, гар ажил үгүй).
5. Rig буруу бол (мөч мушгирсан) → загвар/pose-оо солиод дахин rig хий.

---

## 5. Animation clip-үүд сонгох ⭐ (хамгийн чухал алхам)

Манай код emotion/gesture tag бүрийг **animation clip нэр** рүү зурна
(`emotionMap`). Хамгийн багадаа дараах clip-үүдийг Meshy animation library-гээс
(500+ preset) сонгож загварт нэм:

| Манай tag | Meshy-гээс сонгох ойролцоо preset |
|---|---|
| `idle` | Idle / Breathing Idle (давталттай — **заавал**) |
| `calm` | Idle-ийн зөөлөн хувилбар (эсвэл ижил idle) |
| `happy` | Happy / Cheer / Light bounce |
| `encouraging` | Nod / Approve / Clap (богино) |
| `curious` | Look around / Head tilt |
| `thinking` | Thinking pose / Hand on chin |
| `surprised` | Surprised / Flinch |
| `confused` | Head shake / Shrug |
| `small_nod` | Nod (богино) |
| `wave` | Waving |
| `thumbs_up` | Thumbs up |
| `think_pose` | Thinking pose |
| `smile` | Smile / Happy (богино) |

**Clip нэрийг хэрхэн тохируулах вэ — 2 арга:**

- **Арга A (хялбар, кодгүй):** Meshy preset-ийн нэрийг хэвээр нь export хий
  (ж: "Waving", "Thinking"). Дараа нь **admin `/buddy` хуудасны emotionMap
  editor**-оос манай tag → Meshy-гийн бодит clip нэр рүү зур
  (ж: `wave → Waving`, `thinking → Thinking`). Код `emotionMap`-аар хайна.
- **Арга B (цэвэрхэн):** GLB-г Blender-т нээгээд animation track-уудыг **яг
  манай tag нэрээр** дахин нэрлэ (`idle`, `happy`, `wave`...). Тэгвэл admin-д
  emotionMap бөглөх шаардлагагүй (default map өөрөө tag→ижил нэр рүү зурна).

> Аль ч тохиолдолд **`idle` (эсвэл mapping-д тохирох davталттай clip) заавал**
> байх ёстой — audio байхгүй үед энэ тоглоно. Танихгүй clip ирвэл код `idle`
> руу fallback хийнэ.

---

## 6. Lip-sync бэлтгэл — `mouth_open` (Blender, ~10 мин)

MVP lip-sync нь audio-гийн чангаар (amplitude) **амны нэг morph target**-ыг
хөдөлгөнө. Meshy rig-д ам/эрүү тусдаа хөдөлдөггүй бол Blender-т нэг удаа нэм:

1. GLB-г **Blender**-т Import хий (File → Import → glTF 2.0).
2. Толгойн mesh сонго → **Object Data Properties → Shape Keys**.
3. `Basis` дээр нэмээд шинэ shape key үүсгэ, нэрийг **яг `mouth_open`** гэж өг.
4. Edit Mode-д тэр shape key идэвхтэй байхад амны vertex-үүдийг доош татаж ам
   ангайлга (эсвэл эрүүний хэсгийг нээ). Object Mode-д буц.
5. **Alternative (rig-д jaw bone байвал):** morph key хийхгүй, кодоос jaw
   bone-ийг эргүүлж болно — гэхдээ morph target нь хамгийн энгийн, тогтвортой.
6. Export GLB (доорх §7) — shape key автоматаар GLB-д morph target болж орно.

> Кодын тал: `BuddyAvatar.tsx` (V2) нь `isSpeaking` үед `expo-audio` player-ийн
> metering (amplitude 0–1)-аар `mouth_open` morph-ийн жинг (`morphTargetInfluences`)
> хөдөлгөж, ам ангайлгана. Тиймээс нэр **`mouth_open`** байх ёстой (эсвэл V2-д нэрээ
> тааруул).

---

## 7. GLB export

**Meshy-гээс шууд:** Download → **GLB** сонго, "Include animations" асаалттай.

**Blender-ээс (mouth_open нэмсэн бол):**
- File → Export → **glTF 2.0 (.glb)**.
- Format: **glTF Binary (.glb)**.
- Include: **Selected Objects** (эсвэл бүх model) + **Animations** + **Shape Keys**.
- Compression: **Draco mesh compression** асаа (хэмжээ ↓, three.js Draco уншина).
- Textures: 1024px.
- Экспортын дараа хэмжээ **< 5 MB** эсэхийг шалга (том бол polygon/texture бууруул).

---

## 8. Thumbnail (PNG)

- Meshy-гийн preview-ээс нүүрэн талын screenshot ав, эсвэл 512×512 PNG болго.
- Дэвсгэр тунгалаг (PNG alpha) байвал сайхан.
- Buddy сонголтын жижиг дугуй зурагт (buddy selector) орно.

---

## 9. Cloudinary-д байршуулж, admin-д холбох

1. GLB болон PNG-г **Cloudinary**-д upload хий (SparkXP аль хэдийн Cloudinary
   ашигладаг). GLB-г **raw/auto** resource type-аар байршуул
   (`englishxp/ai-buddy/` folder санал болгоё). Тогтвортой public URL ав.
2. Admin панел (`/buddy`) → холбогдох buddy-г **засах** →
   - **Avatar GLB URL** = Cloudinary GLB URL
   - **Avatar thumbnail URL** = PNG URL
   - Арга A сонгосон бол **emotion/gesture → animation clip map**-ыг Meshy clip
     нэрсээр бөглө.
   - Хадгал → **"Дуу сонсох"** товчоор дуу хоолойг мөн шалгаж болно.
3. Хадгалсны дараа mobile `GET /ai/buddies` энэ URL-уудыг өгнө. `avatarThumbUrl`
   тэр даруй buddy selector-т гарна; `avatarAssetUrl` нь `BuddyAvatar.tsx` (V2)
   бэлэн болмогц 3D-гээр харагдана.

> **Одоогийн зан төлөв:** `avatarAssetUrl`/`avatarThumbUrl` хоосон бол апп
> **2D зураг (`buddy-menu.png`)**-аар үзүүлнэ. Тиймээс GLB алхам алхмаар нэмэгдэж,
> апп унахгүй.

---

## 10. Шалгах жагсаалт (checklist)

- [ ] GLB < 5 MB, texture ≤ 1024px
- [ ] Rig = humanoid/biped, A-pose
- [ ] `idle` (эсвэл mapping-тай давталттай clip) байгаа
- [ ] Дор хаяж: idle, happy, encouraging, curious, thinking, surprised,
      confused + small_nod/wave/thumbs_up/think_pose/smile clip-үүд
- [ ] `mouth_open` morph target (эсвэл jaw bone) байгаа
- [ ] GLB + thumbnail PNG Cloudinary-д, тогтвортой URL-тэй
- [ ] Admin `/buddy`-д `avatarAssetUrl` + `avatarThumbUrl` (+ шаардлагатай бол
      `emotionMap`) бөглөсөн
- [ ] Blender/three.js viewer-т GLB нээгдэж, animation тоглож байгаа

---

## Дараагийн алхам (Part 4 / V2 — код)

GLB бэлэн болмогц Boju `BuddyAvatar.tsx`-ийг бичнэ (`docs/AI_BUDDY_PLAN.md`
Part 4 / Step V2): `three` + `@react-three/fiber` + `expo-gl` суулгаж, GLB
ачаалж, `emotionMap`-аар clip сонгож, `mouth_open`-ыг audio amplitude-аар
хөдөлгөнө. Танихгүй emotion → `idle` fallback.
