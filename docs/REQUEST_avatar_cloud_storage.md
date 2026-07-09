# Хүсэлт (Choi → Өсөхбаяр): Avatar-ыг cloud storage руу шилжүүлэх

**Огноо:** 2026-07-09 · **Хэсэг:** `backend/src/users` · **Ач холбогдол:** Өндөр (prod дээр өгөгдөл алдагдана)

## Асуудал

Хэрэглэгч profile дээрээ өөрийн зургаа сонгож оруулахад mobile тал бүрэн зөв
ажиллаж байна (`POST /users/me/avatar` → шинэчилсэн user → SecureStore-д
хадгалагдана → зураг зөв харагдана). **Гэхдээ backend аватарыг локал диск дээр
хадгалж байгаа нь prod дээр асуудалтай:**

- `users.controller.ts` → `uploadAvatar` нь `diskStorage`-аар файлыг
  `/app/uploads/`-д бичиж, `https://host/uploads/<file>` URL-ийг DB-д хадгална.
- Railway-ийн filesystem **ephemeral** — `railway.json`-д persistent volume
  холбоогүй, Dockerfile зүгээр `mkdir -p uploads` хийдэг.
- Тиймээс **дараагийн deploy / restart болгонд `/uploads` бүхэлдээ устана**:
  - DB дэх `avatarUrl` string үлдэнэ, гэхдээ файл нь алга → URL **404**.
  - Хэрэглэгчийн аватар fallback (нэрний үсэг) рүү буцна.

Бусад бүх медиа (words, idioms, AI buddy зураг/audio) аль хэдийн
**Cloudinary/R2** дээр хадгалагддаг. Аватар л ганцаараа локал диск ашиглаж
байна. CLAUDE.md core rule: *"Storage: Cloud storage + CDN for audio/images."*

## Хүссэн засвар

`users.controller.ts`-ийн `uploadAvatar` дахь `diskStorage`-ийг байгаа
**`ai-gateway/image-storage.service.ts` (R2/Cloudinary)**-ээр солих — бусад медиа
шиг. Ингэснээр:

- Файл cloud дээр хадгалагдаж, deploy хийхэд алга болохгүй.
- `setAvatar(user.id, url)` руу дамжуулах URL нь cloud CDN URL болно
  (одоо ч `http…`-ээр эхэлдэг тул mobile талд өөрчлөлт **шаардлагагүй** —
  `resolveAvatar` ямар ч `http` URL-ийг рендерлэнэ).

## Mobile талд өөрчлөлт шаардлагагүй

`useAvatarPicker` → `uploadAvatar` → `apiUpload` (multipart `file`) урсгал зөв.
Backend зүгээр л cloud URL буцаaxaд л хангалттай.
