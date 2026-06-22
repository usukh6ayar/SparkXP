# EnglishXP — Admin Web (SparkXP)

Vite + React + TypeScript admin dashboard for managing content (words, lessons,
quizzes), users, organizations and more. Talks to the NestJS backend over REST.

## Local development

```bash
npm install
cp .env.example .env     # set VITE_API_URL (defaults to http://localhost:3000/api)
npm run dev              # http://localhost:5173
```

> The backend must be running. CORS for `localhost:5173` is already allowed.

## Environment

| Var | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL, **baked in at build time** (e.g. `https://api.sparkxp.mn/api`). Change it → rebuild. |

⚠️ Each environment has its own database — local and prod data are **not** shared.

## Build

```bash
npm run build           # → dist/  (static SPA)
npm run preview         # preview the production build locally
```

## Deploy

This is a static SPA (client-side routing via React Router), so it can be hosted
on any static host. A catch-all rewrite to `index.html` is **required** so deep
links / refreshes don't 404.

- **Vercel:** zero-config — `vercel.json` (in this folder) sets the build command,
  output dir and SPA rewrite. Set the **Root Directory** to `admin` and add the
  `VITE_API_URL` environment variable in the project settings.
- **Netlify:** set base directory `admin`, build `npm run build`, publish `dist`.
  `public/_redirects` provides the SPA fallback.

### Backend CORS (required for prod)

The deployed admin origin must be allowed by the backend. Set `ADMIN_ORIGIN` in
the backend `.env` to the admin's deployed URL (e.g. `https://admin.sparkxp.mn`)
— see `backend/src/main.ts`.

### Word image generation

The admin can ask the backend to generate vocabulary images when creating or
editing words. This is handled server-side through the AI Gateway, so these keys
belong on the backend host, not in Vercel's admin project:

- `OPENAI_API_KEY`
- `OPENAI_IMAGE_MODEL` (default: `gpt-image-2`)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `CLOUDINARY_WORD_IMAGES_FOLDER` (optional)

If Cloudinary is not configured, the backend saves generated images locally under
`/uploads/generated`, which is only suitable for local development.

## Deploy checklist

1. Backend deployed and reachable; `ADMIN_ORIGIN` = this admin's URL.
2. `VITE_API_URL` = the prod backend `/api` URL.
3. Backend has `OPENAI_API_KEY` + Cloudinary env vars if word images are enabled.
4. `npm run build` passes locally.
5. SPA rewrite in place (`vercel.json` / `_redirects`).
