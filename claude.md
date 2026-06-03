# EnglishXP

Gamified English learning app for Mongolian students, schools, and
organizations (e.g. law firms). Owner: Hustle Hive LLC.

## Team

- 2 developers. Keep code simple, readable, well-documented.
- Avoid over-engineering. MVP first, scale later.

## Tech Stack

- Mobile: React Native + Expo
- Backend: NestJS (TypeScript)
- Database: PostgreSQL + TypeORM
- Cache/Queue: Redis
- Auth: JWT
- Storage: Cloud storage + CDN for audio/images

## Project Structure

- /mobile — React Native (Expo) app
- /backend — NestJS API

## Core Rules

- All learning content (words, lessons, quizzes) lives in the DATABASE,
  never hardcoded. Non-developers must be able to add content via admin panel.
- All AI calls go through a single AI Gateway module. Never call AI APIs
  directly from features. The gateway handles: per-user limits, logging,
  cost tracking.
- Plan limits (voice minutes, tokens, Sparks rate) must be configurable
  from admin/DB without an app update.
- Use UUIDs for all primary keys, not auto-increment ints.
- Use jsonb columns for flexible content (lesson.content, quiz.questions).
- Every table has created_at and updated_at.

## Data Model

Core entities: User, Organization, Class, Lesson, Word, Quiz, Assignment,
WordReview, XpLog, AiUsage, Message, Payment.

- "Organization" covers schools, companies, law firms (type field). One app,
  multiple org types, different content tracks.
- User roles: student, teacher, admin, super_admin (single User table, role field).
- Students join a class via a join_code.

## Gamification

- XP = lifetime progress (logged in XpLog). Sparks = spendable currency.
- XP/Sparks require real interaction + correct answers (anti-abuse).

## Localization

- Bilingual: Mongolian-primary, English-secondary. Use Cyrillic-safe fonts.

## Build Phases

- Phase 1 (MVP): student app — auth, vocabulary, grammar, listening, quizzes,
  XP, text AI buddy, basic admin.
- Phase 2: teacher dashboard, organizations, payments.
- Phase 3: voice AI, premium, Sparks store.
- For voice features in MVP: design the UI but show "coming soon" — don't build
  the STT/TTS logic yet.

## Code Conventions

- TypeScript everywhere. Clear names, small functions.
- Comment non-obvious logic.
- Write code that a junior dev can read.
