# EnglishXP (SparkXP) — Backend API

> Бүх endpoint-ийн лавлах. Хоёр dev (тус тусын Claude)-д зориулсан.
> Бааз хаяг: `http://localhost:3000/api` (`main.ts` → global prefix `api`).
> Роль/эрх: `ROLES.md` · Дүрэм: `CLAUDE.md`.

**Auth тэмдэглэгээ:** 🔓 нээлттэй · 🔑 нэвтэрсэн (JWT Bearer) · 🛡️ admin/super_admin
(`@Roles`) · 👩‍🏫 teacher/admin (Phase 2).

Бүх хамгаалагдсан хүсэлтэд header: `Authorization: Bearer <accessToken>`.

---

## 🔐 Auth — `/api/auth`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/auth/register` | 🔓 | Бүртгүүлэх. Body: `{ email, password, fullName, province?, district? }` → `{ accessToken, user }` |
| POST | `/auth/login` | 🔓 | Нэвтрэх. Body: `{ email, password }` → `{ accessToken, user }` |
| GET | `/auth/me` | 🔑 | Одоогийн хэрэглэгч |

## 👤 Users — `/api/users`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| PATCH | `/users/me` | 🔑 | Өөрийн профайл засах `{ fullName?, province?, district? }` |
| GET | `/users/me/stats` | 🔑 | `{ xp, sparks }` |
| GET | `/users` | 🛡️ | Хэрэглэгчийн жагсаалт (`?page&limit`) — passwordHash хасагдсан |
| DELETE | `/users/:id` | 🛡️ | Хэрэглэгч устгах |

## 📖 Words (Үг) — `/api/words`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/words` | 🔑 | Жагсаалт (`?level&lessonId&page&limit`) |
| GET | `/words/:id` | 🔑 | Нэг үг |
| POST | `/words` | 🛡️ | Үг үүсгэх |
| PATCH | `/words/:id` | 🛡️ | Засах |
| DELETE | `/words/:id` | 🛡️ | Устгах |

## 📚 Lessons (Хичээл) — `/api/lessons`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/lessons` | 🔑 | Жагсаалт (`?type&level&isPublished&page&limit`) |
| GET | `/lessons/:id` | 🔑 | Нэг хичээл |
| POST | `/lessons` | 🛡️ | Үүсгэх (`content` jsonb, `priceSparks`) |
| PATCH | `/lessons/:id` | 🛡️ | Засах / publish |
| DELETE | `/lessons/:id` | 🛡️ | Устгах |
| POST | `/lessons/:id/unlock` | 🔑 | **Spark-аар нээх** (sparks module) |
| GET | `/lessons/:id/access` | 🔑 | Нээгдсэн эсэх `{ hasAccess }` |

## ❓ Quizzes (Сорил) — `/api/quizzes`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/quizzes` | 🔑 | Жагсаалт (`?lessonId&level...`) |
| GET | `/quizzes/:id` | 🔑 | Нэг сорил |
| POST | `/quizzes` | 🛡️ | Үүсгэх (`questions` jsonb) |
| PATCH | `/quizzes/:id` | 🛡️ | Засах |
| DELETE | `/quizzes/:id` | 🛡️ | Устгах |
| POST | `/quizzes/:id/submit` | 🔑 | Хариу илгээх → оноо + XP |

## 🔁 Reviews (Үг давтах, SRS) — `/api/reviews`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/reviews/due` | 🔑 | Өнөөдөр давтах үгс (word-той) |
| POST | `/reviews/:wordId` | 🔑 | Хариу `{ quality: 0-5 }` → SM-2 reschedule |
| GET | `/reviews/learn` | 🔑 | Swipe deck — мэдээгүй үгс (known-г хасна) |
| GET | `/reviews/stats` | 🔑 | `{ known, learning }` — "мэдэх үг" тоо |

## 🤖 AI Gateway — `/api/ai`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/ai/chat` | 🔑 | AI Найз `{ message, conversationId? }` → `{ reply, conversationId }` |
| GET | `/ai/conversations/:conversationId` | 🔑 | Харилцааны түүх |
| PATCH | `/ai/limits` | 🛡️ | Plan limit тохируулах (Redis, app update-гүй) |

## 🏆 Leaderboard — `/api/leaderboard`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/leaderboard` | 🔑 | `?period=weekly|monthly|all_time&scope=global|province|district|class|organization&classId?` → топ N + миний байр |

---

## 🏫 Phase 2 — Organizations / Classes / Assignments / Payments

### Organizations — `/api/organizations`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/organizations` | 🛡️ | Байгууллага үүсгэх |
| GET | `/organizations` | 🛡️ | Жагсаалт |
| GET | `/organizations/:id` | 🔑 | Нэг |
| PATCH | `/organizations/:id` | 🛡️ | Засах |
| DELETE | `/organizations/:id` | 🛡️ | Устгах |

### Classes — `/api/classes`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/classes` | 👩‍🏫 | Класс үүсгэх (`join_code` гарна) |
| POST | `/classes/join` | 🔑 | Оюутан `{ joinCode }`-оор элсэх |
| GET | `/classes` | 🔑 | Класс жагсаалт |
| GET | `/classes/:id` | 🔑 | Нэг класс |
| GET | `/classes/:id/students` | 👩‍🏫 | Класс доторх оюутнууд |

### Assignments — `/api/assignments`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/assignments` | 👩‍🏫 | Даалгавар оноох (lesson/quiz, due date) |
| GET | `/assignments/mine` | 🔑 | Миний даалгаврууд |
| GET | `/assignments` | 👩‍🏫 | (класс/багшийн) даалгаврууд |
| DELETE | `/assignments/:id` | 👩‍🏫 | Устгах |

### Payments — `/api/payments`
| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| POST | `/payments` | 🔑 | Төлбөр үүсгэх (premium / Spark топ-ап) |
| POST | `/payments/:id/confirm` | 🔑 | Төлбөр баталгаажуулах |
| GET | `/payments/my` | 🔑 | Миний төлбөрүүд |
| GET | `/payments` | 🛡️ | Бүх төлбөр (admin) |

## ❤️ Health — `/api/health`

| Method | Path | Auth | Тайлбар |
|---|---|:---:|---|
| GET | `/health` | 🔓 | `{ status, db, redis, timestamp }` — monitoring |

---

## 📦 Стандарт хариу / алдаа

- **Алдаа (global filter):** `{ statusCode, error, message, path, timestamp }`.
  Validation алдаа `message` нь массив (монгол текст).
- **Pagination:** `{ items, total, page, limit }` (эсвэл `{ items, total }`).
- **Status codes:** 200/201 OK · 204 (DELETE) · 400 validation · 401 токенгүй ·
  403 эрх хүрэхгүй · 404 олдсонгүй · 409 давхцал (давхар имэйл).

## 🔑 Жишээ дуудлага

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@englishxp.mn","password":"Admin1234!"}'

# Хамгаалагдсан endpoint
curl http://localhost:3000/api/leaderboard?period=weekly \
  -H "Authorization: Bearer <accessToken>"
```

> Postman collection: `backend/docs/EnglishXP.postman_collection.json` (auth хэсэг).
> Шинэ endpoint нэмбэл энэ файлыг шинэчилнэ үү.
