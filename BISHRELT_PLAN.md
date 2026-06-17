# SparkXP — Bishrelt-ийн ажлын төлөвлөгөө (handoff)

> Усухбаярын талаас гарсан, **Bishrelt хийх** (контент / admin form / quiz /
> backend) ажлуудын тодорхой жагсаалт. Холбоо: `API.md` · `ROLES.md` ·
> `ROADMAP.md` ("Bishrelt АНХААР" хэсэг) · `PRODUCT_BRIEF.md`.
> Тэмдэглэгээ: `[x]` бэлэн · `[~]` хагас · `[ ]` хийх. Сүүлд: 2026-06-17.

---

## 🅰️ Хичээл → Quiz урсгал (шинэ ГОЛ фичер) ⭐

**Зорилго (хүссэн урсгал):** Сурагч хичээл нээх → **видео** үзэх → видео доорх
**quiz-ууд түгжээтэй** → хичээл **дуусгасны дараа unlock** → quiz-ууд **категориор**
бүлэглэгдэн жагсаалтаар гарна → quiz дээр дарж **дараалан хариулна** → төгсгөлд
**оноо % + зөв/буруу** харагдана. **Зөв хариултыг ХАРУУЛАХГҮЙ.**

### Шийдвэрүүд (тохирсон)
- **"Хичээл дуусгах"**: видео placeholder тул эхэндээ **"Хичээл үзсэн ✓" товч** дарвал
  quiz unlock болно (одоо local; дараа backend lesson-completion-той холбоно).
- **Category**: Quiz-д цэвэр **`category` (string)** талбар нэмж, хичээл доторх
  quiz-уудыг түүгээр бүлэглэнэ. (Одоогийн `quizType` нь home-д ашиглагддаг — тусдаа.)

### Хийх ажил
**Backend** (shared)
- [ ] `Quiz.category` (varchar, nullable) багана нэмэх + `CreateQuizDto`-д талбар.
- [ ] (дараа) **Lesson completion tracking** — quiz "тэнцсэн"-ийг per-user бүртгэх
      (`QuizCompletion` эсвэл XpLog-оос), `GET /lessons/:id/progress` (тэнцсэн/нийт quiz → %).
- [x] Quiz submit → `% + breakdown {questionIndex, correct, points}` (**зөв хариулт буцаадаггүй** ✅).
- [x] Quiz `lessonId`-тэй (хичээлийн quiz-ууд).

**Admin web** (Bishrelt)
- [ ] Quiz form-д **category** талбар нэмэх.

**Mobile — хичээлийн дэлгэц** (`app/lesson/[id].tsx`) — *Усухбаяр хийж болзошгүй,
тохиролцоно*
- [ ] Видео дээр + доор: lesson-ийн quiz-уудыг **категориор бүлэглэж** жагсаах.
- [ ] Хичээл дуустал quiz 🔒, "Хичээл үзсэн" товчоор unlock.
- [ ] Quiz дээр дарвал одоогийн **quiz дэлгэц** (`app/quiz/[id].tsx`) — дараалсан
      хариулт → % + зөв/буруу (зөв хариулт нуугдсан, аль хэдийн бэлэн).

> **Quiz-таах дэлгэц аль хэдийн ажилладаг** (дараалал → submit → үр дүн). Гол шинэ
> ажил = хичээлийн дэлгэцэд quiz-уудыг unlock/категори-жагсаалтаар харуулах.

---

## 🅱️ Admin form-ийн дутуу холболтууд (одоо хэрэгтэй)

Backend бэлэн — зөвхөн admin form-д талбар/UI залгах:

- [ ] **Хичээлийн thumbnail** — `admin/src/components/ImageCropUpload.tsx`-г lesson
      form-д залгах (нэг мөр):
      ```tsx
      <ImageCropUpload label="Thumbnail (заавал)" value={form.thumbnailUrl ?? ''}
        onChange={(url) => setForm({ ...form, thumbnailUrl: url })} />
      ```
      Backend `thumbnailUrl` хүлээж авдаг. Зураг **~1200×600 (2:1)**, crop+compress хийдэг.
- [ ] **Гүнзгийрүүлэх хичээл** — lesson form-д **`parentLessonId`** сонгогч (parent
      хичээл сонгох). Backend бэлэн: `GET /lessons` top-level, `?parentId=` хүүхдүүд.
- [ ] **Quiz category** талбар (🅰️-тай хамт).

---

## 🅲️ Auth / shared backend (мэдэгдэл — аль хэдийн орсон)

- [x] **Login** `{ identifier, password }` (`identifier` = username/email). Admin web-ийн
      хуучин `{ email }` мөн ажиллана (`identifier ?? email`). Засах шаардлагагүй.
- [x] **Register** `username` (заавал, unique) + email шаардана, **email OTP** баталгаажуулна.
- [x] `User.emailVerified`, `User.avatarUrl` багана нэмэгдсэн.
- [ ] **MailService stub** (`backend/src/mail/`) — одоо OTP кодыг лог + Redis. Жинхэнэ
      **SMTP/Resend provider**-г энд залгах (credentials бэлэн болоход).

---

## 🅳️ Teacher dashboard гүнзгийрүүлэлт (backend) — mobile M5 🟡

Mobile багшийн хэсэг бэлэн; дараах backend дутуу:
- [ ] Assignment **гүйцэтгэлийн төлөв** (хэн дуусгасан, X/N).
- [ ] Per-student **quiz оноо** aggregate.
- [ ] **Weak topics** (сул сэдэв) — quiz/SRS дататай.

---

## 🅴️ Дэд бүтэц (дараа, Phase 1.5+)

- [ ] **Upload URL fix** — одоо upload URL нь request host (admin localhost)-оор
      үүсдэг → утаснаас зураг харагдахгүй. `FILES_BASE_URL` env эсвэл LAN/CDN-ээр гаргах.
- [ ] **Object storage + CDN** (Cloudflare R2 / S3) — media (зураг/аудио/видео).
- [ ] **Plan caps** config (Free/Standard/Premium) — admin-аас, `PRODUCT_BRIEF.md` §4-5.
- [ ] **AI dictionary** (Gemini, cache-first) · **Voice AI** (cap-тай) — `PRODUCT_BRIEF.md` §5.

---

> ⚠️ **Хуваалцсан backend засвар хийхдээ** PR-ийн өмнө Усухбаяртай тохиролцоорой
> (`API.md` шинэчил). Mobile-ийн student/teacher дэлгэц = Усухбаяр; admin web = Bishrelt;
> backend = хуваалцсан.
