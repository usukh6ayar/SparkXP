# EnglishXP — Mobile (Expo)

React Native + Expo student app. Talks to the backend in `/backend`.
Roadmap: `../MOBILE_ROADMAP.md`.

## Stack

- Expo (managed) + TypeScript
- Expo Router (file-based navigation, `app/`)
- expo-secure-store (JWT storage)
- Mongolian-primary i18n (`src/i18n`)

## Setup & run

```bash
cd mobile
cp .env.example .env        # set EXPO_PUBLIC_API_URL (LAN IP for a real phone)
npm install
npm start                   # then press i (iOS), a (Android), or scan in Expo Go
```

The backend must be running (`cd ../backend && npm run start:dev`).
Seed sample data + an admin: `cd ../backend && npm run seed`
(admin@englishxp.mn / admin123).

## Structure

```
app/                      Expo Router screens
  _layout.tsx             root: AuthProvider + auth gate (redirect)
  index.tsx               entry redirect
  (auth)/login.tsx        login (M0)
  (tabs)/index.tsx        Home (M0 placeholder)
src/
  api/client.ts           fetch wrapper (base URL, Bearer token, errors)
  api/auth.ts             login / register / me
  auth/AuthContext.tsx    session: secure-store token, restore on launch
  i18n/                   Mongolian-primary strings + t()
  theme/                  colors / spacing / type (refine after design)
```

## Status (M0 — Foundation)

Done: project scaffold, API client, AuthContext (token persistence + restore),
auth gate navigation, minimal login + Home. Next: M1 auth screens, then M2
learning screens (see `../MOBILE_ROADMAP.md`).
