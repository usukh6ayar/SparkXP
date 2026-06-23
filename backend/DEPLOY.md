# EnglishXP backend-ийг deploy хийх

Энэ бол NestJS API (`/backend`)-ийг production-д гаргах шалгах хуудас. Жинхэнэ
хэрэглэгчид ажиллахад саад болдог гол 3 зүйлийг хамарна: **өгөгдлийн сангийн
schema**, **имэйл**, **медиа upload** — мөн Docker-оор хэрхэн ажиллуулахыг.

> Локал хөгжүүлэлтийн тохиргоо (локал Postgres/Redis) үндсэн `CLAUDE.md`-д бий.
> Энэ файл зөвхөн production-д гаргах тухай.

---

## 1. Өгөгдлийн сангийн schema (synchronize биш, migration)

Хөгжүүлэлтэд бид `DB_SYNCHRONIZE=true`-г ашиглаж entity-үүдээс хүснэгтүүдийг
автоматаар үүсгэдэг. **Production дээр үүнийг ХЭЗЭЭ Ч бүү ашигла** — synchronize
багана устгаж/өөрчилж, өгөгдөл алдагдуулж болзошгүй. Production нь
`src/migrations/` доторх SQL migration-уудыг ашиглана.

Production дээр дараахыг тохируул:

```env
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=true   # boot хийх үед хүлээгдэж буй migration-уудыг автоматаар ажиллуулна
DB_SSL=true              # Neon / Supabase / ихэнх cloud Postgres-д шаардлагатай
```

`DB_MIGRATIONS_RUN=true` үед app ажиллах болгондоо хүлээгдэж буй migration-уудыг
хэрэгжүүлдэг, тэгэхээр энгийн deploy = контейнерээ ажиллуулах. Хэрэв гараар
ажиллуулахыг хүсвэл `false` үлдээгээд дараахыг ажиллуул:

```bash
npm run migration:run      # хэрэгжүүлэх
npm run migration:revert   # сүүлчийнхийг буцаах
```

**Entity өөрчлөх үед** шинэ migration үүсгээд (ялгааг тооцоход DB хэрэгтэй) commit хий:

```bash
npm run migration:generate -- src/migrations/DescribeYourChange
```

Эхний migration (`InitialSchema`) нь бүх schema-г (`uuid-ossp` extension-той хамт)
үүсгэдэг тул шинэ хоосон өгөгдлийн сан байхад л хангалттай.

---

## 2. Имэйл (OTP баталгаажуулалт + нууц үг сэргээх)

`MailService` нь env-ээс провайдерыг автоматаар сонгоно (код өөрчлөх шаардлагагүй):

1. `RESEND_API_KEY` тохируулсан  → [Resend](https://resend.com) HTTP API (хамгийн хялбар)
2. эсвэл `SMTP_HOST` тохируулсан  → дурын SMTP сервер (Gmail, Mailgun, SES, …)
3. аль нь ч биш                   → хөгжүүлэлтийн **stub**, кодыг зөвхөн log-д бичнэ (имэйл явахгүй)

Хэрэв аль нь ч тохируулагдаагүй бол бүртгэл "ажиллана" ч код зөвхөн серверийн
log-д харагдана — тиймээс **гаргахаасаа өмнө нэгийг нь заавал тохируул**.

```env
# Сонголт A — Resend
RESEND_API_KEY=re_xxx
MAIL_FROM=SparkXP <noreply@yourdomain.mn>   # провайдер дээр баталгаажсан илгээгч байх ёстой

# Сонголт B — SMTP
SMTP_HOST=smtp.yourhost.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=SparkXP <noreply@yourdomain.mn>
```

---

## 3. Медиа upload (зураг / аудио / видео)

`POST /api/upload` болон AI-аар үүсгэсэн үгийн зургууд хоёулаа
`ImageStorageService`-ээр дамждаг бөгөөд тэр нь зорилтыг автоматаар сонгоно:

- `CLOUDINARY_*` тохируулсан үед **Cloudinary** → файлууд тогтвортой + CDN дээр.
- Эс бөгөөс **локал `uploads/` фолдер** → зөвхөн хөгжүүлэлтэд. Ихэнх cloud host-ийн
  файлын систем түр зуурын тул локал хадгалсан файлууд redeploy дээр алга болно.

Production-д Cloudinary-г тохируул:

```env
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## 4. Бусад шаардлагатай env

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<урт-санамсаргүй-тэмдэгт>     # default-оос ӨӨРЧЛӨХ
ADMIN_ORIGIN=https://your-admin.vercel.app   # админ веб-д зориулсан CORS зөвшөөрлийн жагсаалт
# Redis: REDIS_HOST/REDIS_PORT, эсвэл Upstash-д REDIS_URL
```

Бүрэн тайлбартай жагсаалтыг `.env.example`-ээс үз.

---

## 5. Docker-оор ажиллуулах

`Dockerfile` нь 2 шаттай build (эхлээд compile, дараа нь нимгэн prod image).

```bash
# /backend дотроос
docker build -t englishxp-api .

docker run -p 3000:3000 --env-file .env englishxp-api
```

Контейнер `node dist/main.js`-ийг ажиллуулна. `DB_MIGRATIONS_RUN=true` үед эхлэх
үедээ migrate хийгээд `:3000` дээр (`/api` prefix-тэй) ажиллана. Health шалгалт:
`GET /api/health`.

### Платформын тэмдэглэл (Render / Fly гэх мэт)
- Сервисээ энэ Dockerfile-тай `/backend` руу чиглүүл, эсвэл Node build ашиглаж
  build = `npm ci && npm run build`, start = `npm run start:prod` гэж тохируул.
- Managed Postgres + Redis авч дээрх env хувьсагчдыг тохируул.
- Managed Postgres-д `DB_SSL=true` тохируул.

---

## 6. Railway дээр deploy хийх (алхам алхмаар)

Railway нь `backend/railway.json`-г уншиж **Dockerfile**-аар build хийгээд
`/api/health` дээр health шалгана. Code өөрчлөх шаардлагагүй — зөвхөн тохиргоо.

**1. Project + service үүсгэх**
- [railway.app](https://railway.app) → *New Project* → *Deploy from GitHub repo* →
  энэ repo-г сонго.
- Service-ийн **Settings → Root Directory**-г `backend` болго (railway.json,
  Dockerfile тэнд байгаа). Railway автоматаар Dockerfile-аар build хийнэ.

**2. Postgres + Redis нэмэх**
- Project дотор *New → Database → Add PostgreSQL*, мөн *Add Redis*.

**3. Backend service-ийн Variables (env) тохируулах**
```env
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=true
DB_SSL=false           # Railway-н private network дотор SSL шаардлагагүй
JWT_SECRET=<урт-санамсаргүй-тэмдэгт>
ANTHROPIC_API_KEY=<хүчинтэй-key>
OPENAI_API_KEY=<хүчинтэй-key>
RESEND_API_KEY=<resend-key>          # эсвэл SMTP_* (имэйл)
MAIL_FROM=SparkXP <noreply@yourdomain.mn>
CLOUDINARY_CLOUD_NAME=...             # медиа тогтвортой байлгахад
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ADMIN_ORIGIN=https://your-admin.vercel.app
```
> `${{Postgres.DATABASE_URL}}` / `${{Redis.REDIS_URL}}` нь Railway-н reference —
> plugin-ийн утгыг автоматаар татна. `PORT`-г Railway өөрөө өгдөг (код түүнийг
> уншина), гараар тохируулах шаардлагагүй.

**4. Deploy + шалгах**
- Railway автоматаар build хийж deploy хийнэ. *Settings → Networking → Generate
  Domain* дарж public URL ав (`https://xxx.up.railway.app`).
- Эхний deploy дээр `DB_MIGRATIONS_RUN=true` нь schema-г үүсгэнэ. Дараа нь админ
  хэрэглэгч seed хий: service-ийн shell-д `npm run seed`.
- Шалгах: `GET https://<domain>/api/health` → `{"status":"ok"}` буцаах ёстой.

**5. Admin + mobile холбох**
- Admin (Vercel): `VITE_API_URL=https://<domain>/api`.
- Mobile (`mobile/.env`): `EXPO_PUBLIC_API_URL=https://<domain>/api`.
- Backend-ийн `ADMIN_ORIGIN`-д admin-ийн URL-ийг (CORS-д) заавал нэм.
