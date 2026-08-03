# AI Толь — 4 утгатай хайлт + тусдаа толины сан · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Search icon-оор хайсан англи үг нь хэрэглээний давтамжаар эрэмбэлсэн хамгийн ихдээ 4 утга (үг · англи жишээ · монгол орчуулга) буцаадаг болгож, үр дүнг шинэ `dictionary_entries` санд cache-лээд, admin-д "Толь" цэсээр удирддаг болгох. Зэрэгцээд хэрэглэгчийн ⭐ хадгалалтыг `words` банкнаас салгана.

**Spec:** `docs/superpowers/specs/2026-08-03-ai-dictionary-senses-design.md`

**Architecture:** Хоёр шинэ хүснэгт (`dictionary_entries`, `user_dictionary_saves`) нэмнэ; одоо байгаа `translations` хүснэгт болон унших дэлгэцийн давхар-дарах урсгал **огт өөрчлөгдөхгүй**. Backend-д хайлт/хадгалалт/admin CRUD-ыг `DictionaryService`-ээс салган шинэ `DictionarySensesService`-д бичнэ; Gemini дуудлагыг хоёулаа хуваалцах цэвэр helper (`gemini-text.ts`) болгож гаргана. Mobile дээр хайлтын зам нь давхар-дарах popover-оос салж, өргөн карт болно.

**Tech Stack:** NestJS 11 + TypeORM (Postgres, jsonb) · Jest (`*.spec.ts` unit, `*.e2e-spec.ts` supertest) · Vite + React + Tailwind (admin) · React Native + Expo Router (mobile) · Gemini `generateContent` JSON mode.

**Branch:** `usukhbayar`. Ажил эхлэхийн өмнө `git checkout main && git pull origin main && git checkout usukhbayar && git merge main`.

---

## File Structure

**Backend — шинэ**

| Файл | Хариуцах зүйл |
|---|---|
| `backend/src/dictionary/senses.ts` | `WordSense` төрөл, `MAX_SENSES`, `parseSenses()` цэвэр функц, `sensesPrompt()` |
| `backend/src/dictionary/senses.spec.ts` | `parseSenses()`-ийн unit тест |
| `backend/src/dictionary/gemini-text.ts` | `runGeminiText()` — retry-тэй Gemini текст дуудлага (JSON горимтой) |
| `backend/src/dictionary/dictionary-senses.service.ts` | Хайлт + cache · ⭐ хадгалалт · admin CRUD |
| `backend/src/dictionary/dto/update-senses.dto.ts` | `SenseDto`, `UpdateSensesDto` |
| `backend/src/dictionary/dto/query-dictionary.dto.ts` | `QueryDictionaryDto` (admin жагсаалт) |
| `backend/src/entities/dictionary-entry.entity.ts` | `dictionary_entries` |
| `backend/src/entities/user-dictionary-save.entity.ts` | `user_dictionary_saves` |
| `backend/src/migrations/1786500000000-CreateDictionaryEntries.ts` | Prod schema |

**Backend — өөрчлөх**

| Файл | Юу |
|---|---|
| `backend/src/entities/index.ts` | 2 entity нэмэх |
| `backend/src/dictionary/dictionary.service.ts` | `runGemini` → `runGeminiText`-ийг дуудах болгож нимгэлэх; `saveWord()` устгах |
| `backend/src/dictionary/dictionary.controller.ts` | Шинэ route-ууд (тодорхой замууд `:word`-оос **дээр**); `POST /:word/save` устгах |
| `backend/src/dictionary/dictionary.module.ts` | Шинэ repo + service |
| `backend/test/app.e2e-spec.ts` | Толины e2e багц |
| `API.md` | §11 |

**Admin — шинэ:** `admin/src/pages/dictionary/DictionaryPage.tsx`
**Admin — өөрчлөх:** `admin/src/App.tsx`, `admin/src/components/Sidebar.tsx`, `admin/src/auth/access.ts`

**Mobile — өөрчлөх:** `mobile/src/api/dictionary.ts`, `mobile/src/components/DictionaryProvider.tsx`, `mobile/app/saved.tsx`, `mobile/src/i18n/index.ts`

---

## Task 1: `parseSenses()` — Gemini хариу задлагч (TDD)

Gemini чөлөөт текст буцаадаг. Prompt-д "зөвхөн JSON" гэж бичсэн ч ` ```json ` хашилт, 6 утга, дутуу талбар зэрэг гарч ирдэг. Тиймээс задлагч нь **цэвэр функц** байх ба хамгийн түрүүнд тестээр бичигдэнэ.

**Files:**
- Create: `backend/src/dictionary/senses.ts`
- Test: `backend/src/dictionary/senses.spec.ts`

- [ ] **Step 1: Тест бич (унана)**

`backend/src/dictionary/senses.spec.ts`:

```ts
import { parseSenses, MAX_SENSES } from './senses';

/**
 * parseSenses is the only thing standing between Gemini's free-form output and
 * a row that lives in `dictionary_entries` forever. Everything it can't trust
 * gets dropped rather than stored.
 */
describe('parseSenses', () => {
  const sense = (n: number) => ({
    word: `w${n}`,
    example: `Example ${n}.`,
    translation: `Орчуулга ${n}.`,
  });

  it('parses a plain JSON array', () => {
    const raw = JSON.stringify([sense(1), sense(2)]);
    expect(parseSenses(raw)).toEqual([sense(1), sense(2)]);
  });

  it('strips ```json fences', () => {
    const raw = '```json\n' + JSON.stringify([sense(1)]) + '\n```';
    expect(parseSenses(raw)).toEqual([sense(1)]);
  });

  it('accepts a { senses: [...] } wrapper', () => {
    const raw = JSON.stringify({ senses: [sense(1)] });
    expect(parseSenses(raw)).toEqual([sense(1)]);
  });

  it('caps the list at MAX_SENSES', () => {
    const raw = JSON.stringify([1, 2, 3, 4, 5, 6].map(sense));
    expect(parseSenses(raw)).toHaveLength(MAX_SENSES);
    expect(parseSenses(raw)[3]).toEqual(sense(4));
  });

  it('drops entries with a missing or blank field', () => {
    const raw = JSON.stringify([
      sense(1),
      { word: 'w2', example: 'Example 2.' },
      { word: 'w3', example: '   ', translation: 'Орчуулга 3.' },
    ]);
    expect(parseSenses(raw)).toEqual([sense(1)]);
  });

  it('trims whitespace around every field', () => {
    const raw = JSON.stringify([
      { word: '  run  ', example: ' I run. ', translation: ' Би гүйдэг. ' },
    ]);
    expect(parseSenses(raw)).toEqual([
      { word: 'run', example: 'I run.', translation: 'Би гүйдэг.' },
    ]);
  });

  it('returns [] for invalid JSON', () => {
    expect(parseSenses('sorry, I cannot help with that')).toEqual([]);
  });

  it('returns [] for a non-array JSON value', () => {
    expect(parseSenses('{"word":"run"}')).toEqual([]);
  });

  it('returns [] for empty input', () => {
    expect(parseSenses('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Тест унаж байгааг батал**

```bash
cd backend && npx jest --config jest.config.ts src/dictionary/senses.spec.ts
```

Хүлээгдэх: FAIL — `Cannot find module './senses'`.

- [ ] **Step 3: `senses.ts` бич**

`backend/src/dictionary/senses.ts`:

```ts
/**
 * The dictionary "search" result shape: the 4-sense format the product spec
 * asks for. Deliberately has NO title, label or definition — just the word (or
 * phrase), one English example and its Mongolian translation.
 */
export interface WordSense {
  /** The word or phrase this sense belongs to, e.g. "run", "run out of". */
  word: string;
  /** A short English example sentence. */
  example: string;
  /** Mongolian translation of `example`. */
  translation: string;
}

/** Never store or show more than this many senses for one word. */
export const MAX_SENSES = 4;

/** Gemini's JSON schema for a senses request (generationConfig.responseSchema). */
export const SENSES_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      word: { type: 'STRING' },
      example: { type: 'STRING' },
      translation: { type: 'STRING' },
    },
    required: ['word', 'example', 'translation'],
  },
};

/** Prompt asking for the most-common senses of `word`, frequency-ordered. */
export function sensesPrompt(word: string): string {
  return (
    `"${word}" гэсэн англи үгийн бодит амьдрал дээр хамгийн түгээмэл ` +
    'хэрэглэгддэг утгуудыг хэрэглээний давтамжаар (хамгийн түгээмэлээс нь) ' +
    `эрэмбэлж, хамгийн ихдээ ${MAX_SENSES} ширхэгийг JSON массиваар буцаа.\n` +
    'Утга тус бүрд:\n' +
    '- "word": тухайн утгад тохирох үг эсвэл холбоо үг (ж: "run", "run out of")\n' +
    '- "example": богино англи жишээ өгүүлбэр\n' +
    '- "translation": тэр өгүүлбэрийн монгол орчуулга\n' +
    'Тайлбар, тодорхойлолт, шошго, дугаарлалт бүү нэм. ' +
    `Ховор утгыг оруулахгүй — ${MAX_SENSES}-аас цөөн байж болно.`
  );
}

/** One field of a sense: a non-empty string after trimming. */
function cleanField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Turn Gemini's raw reply into at most MAX_SENSES trusted senses.
 *
 * Anything we can't fully verify is dropped instead of stored: the cache row is
 * written once and served forever, so a half-parsed sense would be permanent.
 * Returns [] when nothing survives — the caller then reports "not found" and
 * writes NOTHING to the cache.
 */
export function parseSenses(raw: string): WordSense[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  if (!cleaned) return [];

  let data: unknown;
  try {
    data = JSON.parse(cleaned);
  } catch {
    return [];
  }

  // Accept both a bare array and a { senses: [...] } wrapper.
  const list = Array.isArray(data)
    ? data
    : Array.isArray((data as { senses?: unknown })?.senses)
      ? ((data as { senses: unknown[] }).senses)
      : [];

  const senses: WordSense[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const word = cleanField(row.word);
    const example = cleanField(row.example);
    const translation = cleanField(row.translation);
    if (!word || !example || !translation) continue;
    senses.push({ word, example, translation });
    if (senses.length === MAX_SENSES) break;
  }
  return senses;
}
```

- [ ] **Step 4: Тест давж байгааг батал**

```bash
cd backend && npx jest --config jest.config.ts src/dictionary/senses.spec.ts
```

Хүлээгдэх: PASS — 9 тест.

- [ ] **Step 5: Commit**

```bash
git add backend/src/dictionary/senses.ts backend/src/dictionary/senses.spec.ts
git commit -m "feat(dictionary): parseSenses — Gemini-ийн 4 утгатай JSON хариуг задлагч"
```

---

## Task 2: Gemini текст дуудлагыг helper болгож гаргах

`DictionaryService.runGemini` нь одоо private method. Шинэ service мөн үүнийг хэрэглэх ба JSON горим нэмэх шаардлагатай. Хуулж бичихгүй — гаргаж авна (DRY).

**Files:**
- Create: `backend/src/dictionary/gemini-text.ts`
- Modify: `backend/src/dictionary/dictionary.service.ts` (`runGemini` private method-ийн бие)

- [ ] **Step 1: `gemini-text.ts` үүсгэ**

`backend/src/dictionary/gemini-text.ts`:

```ts
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { geminiRetryDelayMs } from '../words/words.service';

const logger = new Logger('GeminiText');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface GeminiTextResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface GeminiTextOptions {
  /** Ask Gemini to reply with JSON (responseMimeType + optional schema). */
  json?: boolean;
  /** JSON schema for the reply — only used when `json` is true. */
  schema?: unknown;
  /** Sampling temperature. Defaults to 0.3 (the existing dictionary value). */
  temperature?: number;
}

/**
 * One Gemini text call, shared by every dictionary feature.
 *
 * Retries transient 429 / 503 / "high demand" 404 responses the same way the
 * words pipeline does. `label` only appears in logs.
 *
 * Lifted out of DictionaryService so the senses service can reuse it without a
 * copy — and so JSON mode lives in exactly one place.
 */
export async function runGeminiText(
  config: ConfigService,
  prompt: string,
  label: string,
  options: GeminiTextOptions = {},
): Promise<GeminiTextResult> {
  const apiKey = config.get<string>('GEMINI_API_KEY');
  if (!apiKey) {
    throw new InternalServerErrorException('GEMINI_API_KEY тохируулаагүй байна');
  }
  const model = config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const requestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        ...(options.json
          ? {
              responseMimeType: 'application/json',
              ...(options.schema ? { responseSchema: options.schema } : {}),
            }
          : {}),
      },
    }),
  };

  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, requestInit);
    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join('')
        .trim();
      if (!text) {
        throw new InternalServerErrorException('AI хоосон хариу буцаалаа');
      }
      return {
        text,
        model,
        promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    }

    const body = await response.text().catch(() => '');
    const transient =
      response.status === 429 ||
      response.status === 503 ||
      (response.status === 404 &&
        /high demand|unavailable|overloaded|try again/i.test(body));
    if (transient && attempt < MAX_ATTEMPTS) {
      const waitMs = geminiRetryDelayMs(body, attempt);
      logger.warn(
        `Gemini ${response.status} for "${label}" — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs}ms`,
      );
      await sleep(waitMs);
      continue;
    }

    logger.error(`Gemini dictionary failed (${response.status}): ${body}`);
    throw new InternalServerErrorException('Орчуулга үүсгэхэд алдаа гарлаа');
  }
}
```

- [ ] **Step 2: `dictionary.service.ts`-ийн `runGemini`-г нимгэлэ**

`backend/src/dictionary/dictionary.service.ts` дотор `private async runGemini(...)` методын **бүх биеийг** дараахаар сольж, шинэ import нэмнэ:

```ts
import { runGeminiText } from './gemini-text';
```

```ts
  /**
   * Low-level Gemini text call shared by word + sentence translation.
   * Delegates to the shared helper — see gemini-text.ts.
   */
  private async runGemini(
    prompt: string,
    label: string,
  ): Promise<{
    text: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
  }> {
    return runGeminiText(this.config, prompt, label);
  }
```

Мөн файлын дээд талд ашиглагдахаа больсон import-уудыг цэвэрлэ: `Logger` хэрэглэгдсээр байгаа эсэхийг шалга (`this.logger` өөр газар байвал үлдээ), `geminiRetryDelayMs` болон `sleep` дахин хэрэглэгдэхгүй бол устга.

- [ ] **Step 3: Компайл + одоо байгаа тест давж байгааг батал**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npm test
```

Хүлээгдэх: tsc алдаагүй, бүх unit тест PASS (Task 1-ийн 9 тест орсон).

- [ ] **Step 4: Commit**

```bash
git add backend/src/dictionary/gemini-text.ts backend/src/dictionary/dictionary.service.ts
git commit -m "refactor(dictionary): Gemini текст дуудлагыг gemini-text.ts helper болгов"
```

---

## Task 3: Хоёр entity + migration

**Files:**
- Create: `backend/src/entities/dictionary-entry.entity.ts`
- Create: `backend/src/entities/user-dictionary-save.entity.ts`
- Create: `backend/src/migrations/1786500000000-CreateDictionaryEntries.ts`
- Modify: `backend/src/entities/index.ts`

- [ ] **Step 1: `dictionary_entries` entity**

`backend/src/entities/dictionary-entry.entity.ts`:

```ts
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { WordSense } from '../dictionary/senses';

/**
 * The Толь (dictionary) search cache: one row per English word the students
 * have ever searched, holding up to 4 frequency-ordered senses.
 *
 * Deliberately separate from `translations`, which mixes three unrelated things
 * (short glosses, whole-sentence translations keyed by the sentence text, and
 * audio-only stubs with an empty translation). Keeping this table clean is what
 * lets the admin "Толь" page be an unfiltered SELECT.
 *
 * Also separate from the curated `words` bank: nothing a student searches ever
 * lands in the authored vocabulary again.
 */
@Entity('dictionary_entries')
export class DictionaryEntry extends BaseEntity {
  /** Normalised (lowercase, trimmed, single-spaced) English word — cache key. */
  @Index({ unique: true })
  @Column()
  word: string;

  /** 1–4 senses, ordered most-common first. See WordSense. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  senses: WordSense[];

  /** How many times this word has been searched — incremented on cache hits too. */
  @Column({ name: 'search_count', type: 'int', default: 0 })
  searchCount: number;

  @Column({ name: 'last_searched_at', type: 'timestamptz', nullable: true })
  lastSearchedAt: Date | null;

  /** Which model produced the senses, e.g. 'gemini-2.5-flash'. */
  @Column({ type: 'varchar', nullable: true })
  source: string | null;

  /** True once an admin has hand-edited the senses. */
  @Column({ type: 'boolean', default: false })
  edited: boolean;
}
```

- [ ] **Step 2: `user_dictionary_saves` entity**

`backend/src/entities/user-dictionary-save.entity.ts`:

```ts
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from './user.entity';

/**
 * A word the user starred (⭐) from the dictionary — search results and the
 * reading-screen tap popover alike.
 *
 * `word` is a plain string, NOT a FK to dictionary_entries, for two reasons:
 * a word tapped in the reader has no dictionary_entries row (that path only
 * touches `translations`), and deleting an entry from the admin Толь page must
 * not break anyone's saved list.
 *
 * This table replaces the old behaviour where saving created a `needs_review`
 * row in the curated `words` bank.
 */
@Entity('user_dictionary_saves')
@Unique('uq_user_dictionary_save', ['userId', 'word'])
export class UserDictionarySave extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Normalised English word (same normalisation as DictionaryEntry.word). */
  @Column()
  word: string;
}
```

- [ ] **Step 3: `entities/index.ts`-д бүртгэ**

`backend/src/entities/index.ts` — гурван газар нэмнэ (import, export блок, `entities` массив). `QuizAttempt`-ийн дараа:

```ts
import { DictionaryEntry } from './dictionary-entry.entity';
import { UserDictionarySave } from './user-dictionary-save.entity';
```

`export { … }` блокод болон `export const entities = [ … ]` массивт мөн `DictionaryEntry,` `UserDictionarySave,` гэж нэмнэ.

- [ ] **Step 4: Migration бич**

`backend/src/migrations/1786500000000-CreateDictionaryEntries.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Толь (AI dictionary) tables.
 *
 * `dictionary_entries` caches the 4-sense search result per word so the same
 * word is only ever sent to Gemini once. `user_dictionary_saves` holds the ⭐
 * a student puts on a word — previously that created a `needs_review` row in
 * the curated `words` bank, which polluted the admin Words page.
 *
 * Dev (DB_SYNCHRONIZE=true) gets both from the entities; prod runs this.
 */
export class CreateDictionaryEntries1786500000000 implements MigrationInterface {
  name = 'CreateDictionaryEntries1786500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "dictionary_entries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "word" character varying NOT NULL,
        "senses" jsonb NOT NULL DEFAULT '[]',
        "search_count" integer NOT NULL DEFAULT 0,
        "last_searched_at" TIMESTAMP WITH TIME ZONE,
        "source" character varying,
        "edited" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_dictionary_entries_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_dictionary_entries_word" ON "dictionary_entries" ("word")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_dictionary_saves" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "user_id" uuid NOT NULL,
        "word" character varying NOT NULL,
        CONSTRAINT "PK_user_dictionary_saves_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_user_dictionary_saves_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_dictionary_save" ON "user_dictionary_saves" ("user_id", "word")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_dictionary_saves"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "dictionary_entries"`);
  }
}
```

- [ ] **Step 5: Schema үүсч байгааг батал**

Postgres + Redis ажиллаж байхад:

```bash
cd backend && npm run start:dev
```

Лог дээр алдаа гарахгүйг харсны дараа зогсоо, дараа нь:

```bash
psql -d englishxp -c "\d dictionary_entries" -c "\d user_dictionary_saves"
```

Хүлээгдэх: хоёр хүснэгт бүх багана + unique index-тэйгээ гарна.

- [ ] **Step 6: Commit**

```bash
git add backend/src/entities/dictionary-entry.entity.ts \
        backend/src/entities/user-dictionary-save.entity.ts \
        backend/src/entities/index.ts \
        backend/src/migrations/1786500000000-CreateDictionaryEntries.ts
git commit -m "feat(dictionary): dictionary_entries + user_dictionary_saves хүснэгт нэмэв"
```

---

## Task 4: `DictionarySensesService` — хайлт + cache

**Files:**
- Create: `backend/src/dictionary/dictionary-senses.service.ts`
- Modify: `backend/src/dictionary/dictionary.module.ts`

- [ ] **Step 1: Service бич**

`backend/src/dictionary/dictionary-senses.service.ts`:

```ts
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { DictionaryEntry } from '../entities/dictionary-entry.entity';
import { UserDictionarySave } from '../entities/user-dictionary-save.entity';
import { AiUsageType } from '../common/enums';
import { runGeminiText } from './gemini-text';
import {
  parseSenses,
  sensesPrompt,
  MAX_SENSES,
  SENSES_SCHEMA,
  type WordSense,
} from './senses';

/** Search result returned to the mobile Толь card. */
export interface SensesResult {
  word: string;
  senses: WordSense[];
  /** True when served from dictionary_entries (no AI call, no plan usage). */
  cached: boolean;
}

/** One row of the user's ⭐ dictionary list. */
export interface SavedDictionaryWord {
  word: string;
  /** The cached senses, or null if this word was starred from the reader. */
  senses: WordSense[] | null;
  /** One-line subtitle for the list — see the design doc §4.3. */
  translation: string;
}

/** Same normalisation everywhere: trim, lowercase, collapse inner whitespace. */
export const normaliseWord = (raw: string): string =>
  raw.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * The Толь (dictionary) feature: 4-sense search with a permanent cache, the
 * user's ⭐ list, and the admin CRUD behind /dictionary/admin.
 *
 * Split out of DictionaryService, which keeps its original job (short gloss for
 * the reader's double-tap, whole-sentence translation, pronunciation audio).
 */
@Injectable()
export class DictionarySensesService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AiUsage) private readonly aiUsages: Repository<AiUsage>,
    @InjectRepository(Translation)
    private readonly translations: Repository<Translation>,
    @InjectRepository(DictionaryEntry)
    private readonly entries: Repository<DictionaryEntry>,
    @InjectRepository(UserDictionarySave)
    private readonly saves: Repository<UserDictionarySave>,
  ) {}

  /**
   * Look a word up in the Толь. Order: dictionary_entries → Gemini (then cached).
   *
   * The curated `words` bank is NOT consulted: it holds a single meaning per
   * word and cannot produce four, so a hit there would silently downgrade the
   * result. The reader's short-gloss path (DictionaryService.explain) still
   * uses it and is unaffected.
   */
  async search(userId: string, raw: string): Promise<SensesResult> {
    const word = normaliseWord(raw);
    if (!word) throw new BadRequestException('Хоосон үг');

    // 1. Cache hit — still counts as a search, so the admin "most searched"
    //    ordering means something. Must happen BEFORE the early return.
    const hit = await this.entries.findOne({ where: { word } });
    if (hit) {
      await this.entries.increment({ id: hit.id }, 'searchCount', 1);
      await this.entries.update({ id: hit.id }, { lastSearchedAt: new Date() });
      return { word, senses: hit.senses ?? [], cached: true };
    }

    // 2. Plan limit — only enforced when we are actually about to call the AI.
    const user = await this.users.findOne({
      where: { id: userId },
      relations: ['plan'],
    });
    if (user?.plan && user.plan.dictionaryAiLimit !== null) {
      if (user.dictionaryAiCount >= user.plan.dictionaryAiLimit) {
        throw new ForbiddenException(
          `Сарын толь бичгийн хязгаар хэтэрлээ (${user.plan.dictionaryAiLimit} тайлбар/сар)`,
        );
      }
    }

    // 3. Ask Gemini in JSON mode, then distrust the answer anyway.
    const { text, model, promptTokens, completionTokens } = await runGeminiText(
      this.config,
      sensesPrompt(word),
      `senses:${word}`,
      { json: true, schema: SENSES_SCHEMA },
    );
    const senses = parseSenses(text);
    if (senses.length === 0) {
      // Nothing trustworthy came back — report not-found and cache NOTHING, so
      // a bad reply doesn't become a permanent row.
      throw new NotFoundException('Энэ үгийн утга олдсонгүй');
    }

    // 4. Cache. Two users can search the same new word at the same moment; the
    //    unique index decides the winner and the loser reads it back.
    try {
      await this.entries.save(
        this.entries.create({
          word,
          senses,
          searchCount: 1,
          lastSearchedAt: new Date(),
          source: model,
          edited: false,
        }),
      );
    } catch {
      const existing = await this.entries.findOne({ where: { word } });
      if (existing) return { word, senses: existing.senses ?? [], cached: true };
      throw new NotFoundException('Энэ үгийн утга олдсонгүй');
    }

    // 5. Usage log + monthly counter. Its own `feature` so the admin Usage page
    //    can separate the cost from the short-gloss lookups.
    const costMicroUsd =
      Math.round(promptTokens * 0.0001) + Math.round(completionTokens * 0.0004);
    await this.aiUsages.save(
      this.aiUsages.create({
        userId,
        type: AiUsageType.TEXT_CHAT,
        model,
        promptTokens,
        completionTokens,
        voiceSeconds: 0,
        costMicroUsd,
        metadata: { feature: 'dictionary_senses', word },
      }),
    );
    if (user) {
      await this.users.increment({ id: userId }, 'dictionaryAiCount', 1);
    }

    return { word, senses, cached: false };
  }

  /** The user's ⭐ words, newest first. */
  async listSaves(userId: string): Promise<SavedDictionaryWord[]> {
    const rows = await this.saves.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (rows.length === 0) return [];

    const words = rows.map((r) => r.word);
    const [entries, glosses] = await Promise.all([
      this.entries.find({ where: { word: In(words) } }),
      this.translations.find({ where: { word: In(words) } }),
    ]);
    const entryByWord = new Map(entries.map((e) => [e.word, e]));
    const glossByWord = new Map(glosses.map((g) => [g.word, g]));

    // Subtitle order (design §4.3): the short gloss if the word was ever tapped
    // in the reader, else the first sense's SENTENCE translation, else nothing.
    // Nothing is snapshotted, so an admin edit shows up immediately.
    return rows.map((r) => {
      const entry = entryByWord.get(r.word) ?? null;
      const gloss = glossByWord.get(r.word)?.translation?.trim() ?? '';
      return {
        word: r.word,
        senses: entry?.senses ?? null,
        translation: gloss || entry?.senses?.[0]?.translation || '',
      };
    });
  }

  /** Toggle ⭐ for a word. Never touches the curated `words` bank. */
  async toggleSave(
    userId: string,
    raw: string,
  ): Promise<{ word: string; saved: boolean }> {
    const word = normaliseWord(raw);
    if (!word) throw new BadRequestException('Хоосон үг');

    const existing = await this.saves.findOne({ where: { userId, word } });
    if (existing) {
      await this.saves.remove(existing);
      return { word, saved: false };
    }
    await this.saves.save(this.saves.create({ userId, word }));
    return { word, saved: true };
  }

  // ── Admin ────────────────────────────────────────────────────────────────

  /** Paginated Толь listing for the admin panel. */
  async adminList(query: {
    search?: string;
    page?: number;
    limit?: number;
    sort?: 'searches' | 'recent';
  }): Promise<{
    items: DictionaryEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));

    const qb = this.entries.createQueryBuilder('e');
    const search = query.search?.trim();
    if (search) {
      qb.where('e.word ILIKE :search', { search: `%${search.toLowerCase()}%` });
    }
    if (query.sort === 'recent') {
      qb.orderBy('e.createdAt', 'DESC');
    } else {
      qb.orderBy('e.searchCount', 'DESC').addOrderBy('e.createdAt', 'DESC');
    }
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  /** Replace an entry's senses by hand; marks it as edited. */
  async adminUpdate(id: string, senses: WordSense[]): Promise<DictionaryEntry> {
    const entry = await this.entries.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Толины бичлэг олдсонгүй');
    entry.senses = senses.slice(0, MAX_SENSES);
    entry.edited = true;
    return this.entries.save(entry);
  }

  /** Delete an entry. The next search for that word regenerates it via AI. */
  async adminRemove(id: string): Promise<{ deleted: true }> {
    const result = await this.entries.delete(id);
    if (!result.affected) {
      throw new NotFoundException('Толины бичлэг олдсонгүй');
    }
    return { deleted: true };
  }
}
```

- [ ] **Step 2: Module-д бүртгэ**

`backend/src/dictionary/dictionary.module.ts`-ийг бүтнээр нь солино:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { Word } from '../entities/word.entity';
import { WordReview } from '../entities/word-review.entity';
import { AiUsage } from '../entities/ai-usage.entity';
import { Translation } from '../entities/translation.entity';
import { DictionaryEntry } from '../entities/dictionary-entry.entity';
import { UserDictionarySave } from '../entities/user-dictionary-save.entity';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { DictionaryService } from './dictionary.service';
import { DictionarySensesService } from './dictionary-senses.service';
import { DictionaryController } from './dictionary.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Word,
      WordReview,
      AiUsage,
      Translation,
      DictionaryEntry,
      UserDictionarySave,
    ]),
    AiGatewayModule,
  ],
  providers: [DictionaryService, DictionarySensesService],
  controllers: [DictionaryController],
})
export class DictionaryModule {}
```

- [ ] **Step 3: Компайл**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json
```

Хүлээгдэх: алдаагүй.

- [ ] **Step 4: Commit**

```bash
git add backend/src/dictionary/dictionary-senses.service.ts backend/src/dictionary/dictionary.module.ts
git commit -m "feat(dictionary): DictionarySensesService — 4 утгатай хайлт, ⭐, admin CRUD"
```

---

## Task 5: DTO-ууд + controller route-ууд

⚠️ **Хамгийн чухал нарийн зүйл:** одоогийн `@Get(':word')` нь нэг сегменттэй бүх GET-ийг залгидаг тул `/dictionary/saves` түүнд баригдана. Шинэ тодорхой route-ууд файл дотор `@Get(':word')`-оос **дээр** байх ёстой.

**Files:**
- Create: `backend/src/dictionary/dto/update-senses.dto.ts`
- Create: `backend/src/dictionary/dto/query-dictionary.dto.ts`
- Modify: `backend/src/dictionary/dictionary.controller.ts` (бүтнээр солино)
- Modify: `backend/src/dictionary/dictionary.service.ts` (`saveWord` устгах)

- [ ] **Step 1: `update-senses.dto.ts`**

```ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_SENSES } from '../senses';

/** One hand-edited sense row from the admin Толь editor. */
export class SenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  word: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  example: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  translation: string;
}

/** PATCH /dictionary/admin/entries/:id body. */
export class UpdateSensesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_SENSES)
  @ValidateNested({ each: true })
  @Type(() => SenseDto)
  senses: SenseDto[];
}
```

- [ ] **Step 2: `query-dictionary.dto.ts`**

```ts
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** GET /dictionary/admin/entries query. */
export class QueryDictionaryDto {
  /** Substring match on the word (case-insensitive). */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** `searches` (default) = most-searched first; `recent` = newest first. */
  @IsOptional()
  @IsIn(['searches', 'recent'])
  sort?: 'searches' | 'recent';
}
```

- [ ] **Step 3: Controller-ийг бүтнээр сольж бич**

`backend/src/dictionary/dictionary.controller.ts`:

```ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { UserRole } from '../common/enums';
import { DictionaryService } from './dictionary.service';
import { DictionarySensesService } from './dictionary-senses.service';
import { TranslateSentenceDto } from './dto/translate-sentence.dto';
import { UpdateSensesDto } from './dto/update-senses.dto';
import { QueryDictionaryDto } from './dto/query-dictionary.dto';

/**
 * /api/dictionary — two related features in one controller:
 *
 *  - Толь search (`/search`, `/saves`, `/admin/*`): the 4-sense result the
 *    search icon opens, cached in `dictionary_entries`.
 *  - Reader helpers (`/:word`, `/translate`, `/:word/audio`): the short gloss,
 *    whole-sentence translation and pronunciation audio. Unchanged.
 *
 * ⚠️ ROUTE ORDER MATTERS. `@Get(':word')` matches any single-segment GET, so
 * every literal path (`/saves`) must be declared ABOVE it or Nest will route
 * `/dictionary/saves` into the word lookup.
 */
@Controller('dictionary')
@UseGuards(JwtAuthGuard)
export class DictionaryController {
  constructor(
    private readonly dictionary: DictionaryService,
    private readonly senses: DictionarySensesService,
  ) {}

  // ── Толь: admin (declare before the :word routes) ────────────────────────

  /** GET /api/dictionary/admin/entries — paginated Толь listing. */
  @Get('admin/entries')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  adminList(@Query() query: QueryDictionaryDto) {
    return this.senses.adminList(query);
  }

  /** PATCH /api/dictionary/admin/entries/:id — hand-edit the senses. */
  @Patch('admin/entries/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSensesDto,
  ) {
    return this.senses.adminUpdate(id, dto.senses);
  }

  /** DELETE /api/dictionary/admin/entries/:id — the next search regenerates it. */
  @Delete('admin/entries/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.MODERATOR)
  adminRemove(@Param('id', ParseUUIDPipe) id: string) {
    return this.senses.adminRemove(id);
  }

  // ── Толь: student ────────────────────────────────────────────────────────

  /** GET /api/dictionary/saves — the user's ⭐ dictionary words. */
  @Get('saves')
  listSaves(@CurrentUser() user: User) {
    return this.senses.listSaves(user.id);
  }

  /** POST /api/dictionary/saves/:word — toggle ⭐ for a word. */
  @Post('saves/:word')
  toggleSave(@Param('word') word: string, @CurrentUser() user: User) {
    return this.senses.toggleSave(user.id, word);
  }

  /**
   * GET /api/dictionary/search/:word
   * Up to 4 frequency-ordered senses. Cache → Gemini (plan-limited, cached).
   */
  @Get('search/:word')
  search(@Param('word') word: string, @CurrentUser() user: User) {
    return this.senses.search(user.id, word);
  }

  // ── Reader helpers (unchanged behaviour) ─────────────────────────────────

  /**
   * POST /api/dictionary/translate
   * Full Mongolian translation of an English sentence/phrase (reading reader:
   * long-press a sentence). Cache → Gemini (sentence prompt), plan-limited.
   */
  @Post('translate')
  translate(@Body() dto: TranslateSentenceDto, @CurrentUser() user: User) {
    return this.dictionary.translateSentence(user.id, dto.text);
  }

  /**
   * GET /api/dictionary/:word/audio
   * Pronunciation audio URL (ElevenLabs). Generated once on the first speaker
   * tap, then cached and reused forever.
   */
  @Get(':word/audio')
  audio(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.getAudio(user.id, word);
  }

  /**
   * GET /api/dictionary/:word
   * Short Mongolian meaning for an English word (reader double-tap).
   * Word DB → translation cache → Gemini (plan-limited, result cached).
   */
  @Get(':word')
  explain(@Param('word') word: string, @CurrentUser() user: User) {
    return this.dictionary.explain(user.id, word);
  }
}
```

- [ ] **Step 4: `saveWord()`-ыг `dictionary.service.ts`-ээс устга**

`backend/src/dictionary/dictionary.service.ts` дотроос `async saveWord(...)` методыг **бүтнээр нь устга** (энэ л `words`-д `needs_review` мөр үүсгэдэг байсан). Дараа нь ашиглагдахаа больсон import-уудыг цэвэрлэ: `WordReview` repo болон `WordStatus`, `ContentLevel` enum-ууд өөр газар хэрэглэгдэхгүй бол устга.

`dictionary.module.ts`-ээс `WordReview`-г **бүү хас** — `TypeOrmModule.forFeature`-д үлдээх нь хор хөнөөлгүй, гэхдээ service-ийн constructor-оос `@InjectRepository(WordReview)` мөрийг устгасан бол module-оос ч хасаж болно. Хоёуланг нь зэрэг хий.

- [ ] **Step 5: Компайл + тест**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npm test
```

Хүлээгдэх: алдаагүй, бүх unit тест PASS.

- [ ] **Step 6: Route дараалал зөв эсэхийг гараар шалга**

Сервер асаагаад (`npm run start:dev`), нэвтэрсэн хэрэглэгчийн token-оор:

```bash
TOKEN=<student jwt>
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/dictionary/saves
```

Хүлээгдэх: `[]` (JSON массив) — **`{"word":"saves",...}` гэсэн gloss хариу ирвэл route дараалал буруу**.

- [ ] **Step 7: Commit**

```bash
git add backend/src/dictionary/
git commit -m "feat(dictionary): Толины search/saves/admin route нэмж, /:word/save устгав"
```

---

## Task 6: e2e тест

Gemini-г тестээс дуудахгүй (API key + зардал + тогтворгүй). Тиймээс cache мөрийг DB рүү шууд суулгаад, AI дуудахгүй бүх замыг шалгана.

**Files:**
- Modify: `backend/test/app.e2e-spec.ts` (файлын төгсгөлд шинэ `describe` нэмнэ)

- [ ] **Step 1: Тест бич**

`backend/test/app.e2e-spec.ts`-ийн төгсгөлд:

```ts
// ── Толь (dictionary senses) ─────────────────────────────────────────────────

describe('Dictionary — Толь', () => {
  let app: INestApplication;
  let ds: DataSource;
  let token: string;
  let adminToken: string;
  /** A word that only this run uses, so reruns don't collide. */
  const word = `zzrun${RUN}`;
  let entryId: string;

  beforeAll(async () => {
    app = await createApp();
    ds = app.get(DataSource);
    token = await registerAndLogin(app, mail('dict_user'));

    // Promote to admin in the DB. No re-login needed: the JWT carries no role,
    // JwtStrategy reads it from the DB on every request.
    adminToken = await registerAndLogin(app, mail('dict_admin'));
    const adminRes = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    await ds.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminRes.body.id]);

    // Seed the cache directly — the AI path is not exercised in e2e.
    const senses = JSON.stringify([
      { word, example: 'I run every morning.', translation: 'Би өглөө бүр гүйдэг.' },
      { word: `${word} out of`, example: 'We ran out of food.', translation: 'Бидний хоол дууссан.' },
    ]);
    const rows = await ds.query(
      `INSERT INTO dictionary_entries ("word", "senses", "search_count", "source")
       VALUES ($1, $2::jsonb, 0, 'seed') RETURNING id`,
      [word, senses],
    );
    entryId = rows[0].id;
  });

  afterAll(async () => {
    // ⭐ rows are keyed on the word, not on the entry — delete them first.
    await ds.query(`DELETE FROM user_dictionary_saves WHERE word LIKE $1`, [`%${RUN}%`]);
    await ds.query(`DELETE FROM dictionary_entries WHERE word LIKE $1`, [`%${RUN}%`]);
    await app.close();
  });

  it('GET /api/dictionary/search/:word → cached senses', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/dictionary/search/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.cached).toBe(true);
    expect(res.body.senses).toHaveLength(2);
    expect(res.body.senses[0].translation).toBe('Би өглөө бүр гүйдэг.');
  });

  it('a cache hit still increments search_count', async () => {
    const before = await ds.query(
      `SELECT search_count FROM dictionary_entries WHERE id = $1`,
      [entryId],
    );
    await request(app.getHttpServer())
      .get(`/api/dictionary/search/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const after = await ds.query(
      `SELECT search_count, last_searched_at FROM dictionary_entries WHERE id = $1`,
      [entryId],
    );

    expect(Number(after[0].search_count)).toBe(Number(before[0].search_count) + 1);
    expect(after[0].last_searched_at).not.toBeNull();
  });

  it('POST /api/dictionary/saves/:word toggles the star both ways', async () => {
    const on = await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(on.body.saved).toBe(true);

    const listed = await request(app.getHttpServer())
      .get('/api/dictionary/saves')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body.map((r: { word: string }) => r.word)).toContain(word);
    expect(listed.body[0].senses).toHaveLength(2);

    const off = await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(off.body.saved).toBe(false);
  });

  it('starring never creates a row in the curated words bank', async () => {
    await request(app.getHttpServer())
      .post(`/api/dictionary/saves/${word}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    const rows = await ds.query(`SELECT id FROM words WHERE english = $1`, [word]);
    expect(rows).toHaveLength(0);
  });

  it('GET /api/dictionary/admin/entries is admin-only', async () => {
    await request(app.getHttpServer())
      .get('/api/dictionary/admin/entries')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    const res = await request(app.getHttpServer())
      .get(`/api/dictionary/admin/entries?search=${word}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].word).toBe(word);
  });

  it('PATCH /api/dictionary/admin/entries/:id marks the entry edited', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/dictionary/admin/entries/${entryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        senses: [
          { word, example: 'Edited example.', translation: 'Зассан орчуулга.' },
        ],
      })
      .expect(200);

    expect(res.body.edited).toBe(true);
    expect(res.body.senses).toHaveLength(1);
  });
});
```

- [ ] **Step 2: e2e ажиллуул**

Postgres + Redis асаалттай, `DB_SYNCHRONIZE=true` байхад:

```bash
cd backend && npm run test:e2e -- -t "Толь"
```

Хүлээгдэх: 6 тест PASS.

- [ ] **Step 3: Бүх e2e багц эвдрээгүйг батал**

```bash
cd backend && npm run test:e2e
```

Хүлээгдэх: өмнөх бүх багц адилхан PASS (`/dictionary/:word/save` устгасан нь өөр тестийг эвдээгүй байх ёстой).

- [ ] **Step 4: Commit**

```bash
git add backend/test/app.e2e-spec.ts
git commit -m "test(dictionary): Толины cache/⭐/admin урсгалын e2e"
```

---

## Task 7: `API.md` шинэчлэх

**Files:**
- Modify: `API.md` (§11 Dictionary, мөр ~304–312 ба §frontend usage map мөр ~616)

- [ ] **Step 1: §11-ийн хүснэгтийг сольж бич**

`## 11. Dictionary — /api/dictionary` доорх хүснэгтийг:

```markdown
| GET `/dictionary/search/:word` | JWT | **Толь:** хамгийн ихдээ 4 утга (үг · англи жишээ · монгол орчуулга), хэрэглээний давтамжаар. `dictionary_entries` cache → Gemini | path `word` |
| GET `/dictionary/saves` | JWT | Хэрэглэгчийн ⭐ тольны үгс | — |
| POST `/dictionary/saves/:word` | JWT | ⭐ toggle. `words` банкинд мөр үүсгэхгүй | path `word` |
| GET `/dictionary/admin/entries` | admin/super_admin/moderator | Толины жагсаалт (хуудаслалт) | query `search`, `page`, `limit`, `sort=searches\|recent` |
| PATCH `/dictionary/admin/entries/:id` | admin/super_admin/moderator | Утгуудыг гараар засах (`edited=true`) | body `{ senses: [{word, example, translation}] }` (1–4) |
| DELETE `/dictionary/admin/entries/:id` | admin/super_admin/moderator | Толины бичлэг устгах | path `id` |
| GET `/dictionary/:word` | JWT | Богино монгол утга (DB → cache → Gemini) — унших дэлгэцийн давхар дарах | path `word` |
| POST `/dictionary/translate` | JWT | Өгүүлбэрийн бүтэн монгол орчуулга (cache → Gemini) | body `{ text }` |
| GET `/dictionary/:word/audio` | JWT | Дуудлагын аудио URL (ElevenLabs, cached) | path `word` |
```

`POST /dictionary/:word/save` мөрийг **устга** — тэр endpoint байхгүй болсон.

Хүснэгтийн доор нэмэлт тэмдэглэл нэм:

```markdown
> ⚠️ Route дараалал: `@Get(':word')` нь нэг сегменттэй бүх GET-ийг залгидаг тул
> `/saves`, `/search/:word`, `/admin/*` нь controller дотор түүнээс дээр байрлана.
```

- [ ] **Step 2: Frontend usage map-ийн `dictionary.ts` мөрийг шинэчил**

```markdown
| `dictionary.ts` | `searchWord`→GET `/dictionary/search/:word` · `lookupWord`→GET `/dictionary/:word` · `translateSentence`→POST `/dictionary/translate` · `getWordAudio`→GET `/dictionary/:word/audio` · `getDictionarySaves`→GET `/dictionary/saves` · `toggleDictionarySave`→POST `/dictionary/saves/:word` |
```

- [ ] **Step 3: Commit**

```bash
git add API.md
git commit -m "docs(api): Толины endpoint-ууд API.md §11-д"
```

---

## Task 8: Admin — "Толь" хуудас

**Files:**
- Create: `admin/src/pages/dictionary/DictionaryPage.tsx`
- Modify: `admin/src/App.tsx`, `admin/src/components/Sidebar.tsx`, `admin/src/auth/access.ts`

- [ ] **Step 1: Хуудсыг бич**

`admin/src/pages/dictionary/DictionaryPage.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Pagination } from '../../components/Pagination';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

interface Sense {
  word: string;
  example: string;
  translation: string;
}

interface Entry {
  id: string;
  word: string;
  senses: Sense[];
  searchCount: number;
  lastSearchedAt: string | null;
  source: string | null;
  edited: boolean;
  createdAt: string;
}

interface Page {
  items: Entry[];
  total: number;
  page: number;
  limit: number;
}

const EMPTY: Page = { items: [], total: 0, page: 1, limit: 50 };

/**
 * Толь — the AI dictionary search cache. Every word a student searches lands
 * here (not in the curated Үгс bank). Admins fix bad AI output or delete a row;
 * a deleted word is regenerated by AI on the next search.
 */
export default function DictionaryPage() {
  const [data, setData] = useState<Page>(EMPTY);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'searches' | 'recent'>('searches');
  const [editing, setEditing] = useState<Entry | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), sort });
    if (search.trim()) q.set('search', search.trim());
    api.get<Page>(`/dictionary/admin/entries?${q}`).then(setData).catch(() => {});
  }, [page, search, sort]);

  // Debounce the search box so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(load, 300);
    return () => clearTimeout(id);
  }, [load]);

  // A new search/sort must restart at page 1, else you can land past the end.
  useEffect(() => { setPage(1); }, [search, sort]);

  const remove = async (entry: Entry) => {
    if (!confirm(`"${entry.word}" толиноос устгах уу?\n\nДараагийн хайлтад AI дахин үүсгэнэ.`)) return;
    await api.delete(`/dictionary/admin/entries/${entry.id}`);
    load();
  };

  return (
    <>
      <PageHeader
        title="Толь"
        description="Хэрэглэгчдийн хайсан үгс + AI-гийн үүсгэсэн утгууд. Үгсийн сангаас тусдаа."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Үг хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          wrapperClassName="w-64"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'searches' | 'recent')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm"
        >
          <option value="searches">Хамгийн их хайгдсан</option>
          <option value="recent">Шинэ нь эхэндээ</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Үг</th>
              <th className="px-4 py-3 font-medium">Утга</th>
              <th className="px-4 py-3 font-medium">Хайлт</th>
              <th className="px-4 py-3 font-medium">Сүүлд</th>
              <th className="px-4 py-3 font-medium">Эх</th>
              <th className="px-4 py-3 font-medium">Үйлдэл</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{e.word}</td>
                <td className="px-4 py-3 text-gray-600">{e.senses.length}</td>
                <td className="px-4 py-3 text-gray-600">{e.searchCount}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                  {e.lastSearchedAt ? new Date(e.lastSearchedAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400">
                  {e.edited ? '✏️ зассан' : (e.source ?? '—')}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(e)} className="text-gray-400 hover:text-primary" title="Засах">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => remove(e)} className="text-gray-400 hover:text-red-500" title="Устгах">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Одоогоор хайсан үг алга байна
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />

      {editing && (
        <EditSensesModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </>
  );
}

/** Edit up to 4 senses by hand. Blank rows are dropped, not saved. */
function EditSensesModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Always render 4 rows so an admin can add a missing sense.
  const [rows, setRows] = useState<Sense[]>(() => {
    const filled = [...entry.senses];
    while (filled.length < 4) filled.push({ word: '', example: '', translation: '' });
    return filled.slice(0, 4);
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (i: number, field: keyof Sense, value: string) =>
    setRows((prev) => prev.map((r, n) => (n === i ? { ...r, [field]: value } : r)));

  const submit = async () => {
    const senses = rows.filter(
      (r) => r.word.trim() && r.example.trim() && r.translation.trim(),
    );
    if (senses.length === 0) {
      setError('Дор хаяж нэг бүрэн утга бөглөнө үү');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.patch(`/dictionary/admin/entries/${entry.id}`, { senses });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`"${entry.word}" — утгууд`} onClose={onClose} size="lg">
      <div className="flex flex-col gap-5">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
            <span className="text-xs font-semibold text-gray-400">{i + 1}.</span>
            <Input
              label="Үг / холбоо үг"
              value={row.word}
              onChange={(e) => setField(i, 'word', e.target.value)}
            />
            <Input
              label="Англи жишээ"
              value={row.example}
              onChange={(e) => setField(i, 'example', e.target.value)}
            />
            <Input
              label="Монгол орчуулга"
              value={row.translation}
              onChange={(e) => setField(i, 'translation', e.target.value)}
            />
          </div>
        ))}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Болих</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Хадгалж байна...' : 'Хадгалах'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Route бүртгэ**

`admin/src/App.tsx` — lazy import (WordsPage-ийн дор):

```tsx
const DictionaryPage = lazy(() => import('./pages/dictionary/DictionaryPage'));
```

Route (`/words`-ийн шууд дор):

```tsx
            <Route path="/dictionary"    element={<DictionaryPage />} />
```

- [ ] **Step 3: Sidebar + access**

`admin/src/components/Sidebar.tsx` — `lucide-react` import-д `BookMarked` нэмээд, `nav` массивт `/words`-ийн шууд дор:

```tsx
  { to: '/dictionary',    label: 'Толь',         icon: BookMarked },
```

`admin/src/auth/access.ts` — `MODERATOR_PATHS`-д `'/words'`-ийн дор:

```ts
  '/dictionary',
```

- [ ] **Step 4: Build + гараар шалга**

```bash
cd admin && npx tsc --noEmit && npm run build
```

Хүлээгдэх: алдаагүй.

`npm run dev` → admin-д нэвтэр → зүүн цэсэнд **Толь** гарч ирнэ → дарахад хүснэгт (эхэндээ хоосон) → backend дээр нэг хайлт хийсний дараа мөр гарч ирж, **Засах** цонх нээгдэж, хадгалахад "✏️ зассан" болно.

- [ ] **Step 5: Commit**

```bash
git add admin/src/pages/dictionary/DictionaryPage.tsx admin/src/App.tsx \
        admin/src/components/Sidebar.tsx admin/src/auth/access.ts
git commit -m "feat(admin): Толь хуудас — хайсан үгс, утга засах/устгах"
```

---

## Task 9: Mobile API давхарга

**Files:**
- Modify: `mobile/src/api/dictionary.ts`

- [ ] **Step 1: Файлыг бүтнээр сольж бич**

```ts
import { apiRequest } from './client';

/**
 * One sense of a searched word: the Толь format. No title, no definition —
 * just the word (or phrase), an English example and its Mongolian translation.
 */
export interface WordSense {
  word: string;
  example: string;
  translation: string;
}

export interface WordLookup {
  /** The looked-up word, normalised to lowercase by the backend. */
  word: string;
  /** Short Mongolian meaning. */
  translation: string;
  /** Pronunciation audio URL if already generated, else null. */
  audioUrl: string | null;
  /** True when served from the Words DB / cache (free), false when from AI. */
  cached: boolean;
}

/** GET /api/dictionary/search/:word result — up to 4 senses, most common first. */
export interface SensesResult {
  word: string;
  senses: WordSense[];
  cached: boolean;
}

/** One row of the user's ⭐ dictionary list. */
export interface SavedDictionaryWord {
  word: string;
  /** Cached senses, or null when the word was starred from the reader. */
  senses: WordSense[] | null;
  /** One-line subtitle: short gloss, else the first sense's translation. */
  translation: string;
}

/**
 * GET /api/dictionary/search/:word — the Толь search result (max 4 senses).
 * Backend order: dictionary_entries cache → Gemini (cached after).
 */
export function searchWord(token: string, word: string): Promise<SensesResult> {
  return apiRequest<SensesResult>(
    `/dictionary/search/${encodeURIComponent(word)}`,
    { token },
  );
}

/**
 * GET /api/dictionary/:word — short Mongolian meaning of an English word
 * (reader double-tap). Backend: Word DB → translation cache → Gemini.
 */
export function lookupWord(token: string, word: string): Promise<WordLookup> {
  return apiRequest<WordLookup>(`/dictionary/${encodeURIComponent(word)}`, { token });
}

/**
 * POST /api/dictionary/translate — full Mongolian translation of an English
 * sentence/phrase (not a 1–4 word gloss).
 */
export function translateSentence(
  token: string,
  text: string,
): Promise<{ translation: string }> {
  return apiRequest<{ translation: string }>('/dictionary/translate', {
    method: 'POST',
    body: { text },
    token,
  });
}

/**
 * GET /api/dictionary/:word/audio — pronunciation audio URL (ElevenLabs).
 * Generated once on first request, then cached & reused.
 */
export function getWordAudio(
  token: string,
  word: string,
): Promise<{ audioUrl: string }> {
  return apiRequest<{ audioUrl: string }>(
    `/dictionary/${encodeURIComponent(word)}/audio`,
    { token },
  );
}

/** GET /api/dictionary/saves — the user's ⭐ dictionary words. */
export function getDictionarySaves(token: string): Promise<SavedDictionaryWord[]> {
  return apiRequest<SavedDictionaryWord[]>('/dictionary/saves', { token });
}

/**
 * POST /api/dictionary/saves/:word — toggle ⭐. Unlike the old
 * `/dictionary/:word/save`, this never creates a row in the curated word bank.
 */
export function toggleDictionarySave(
  token: string,
  word: string,
): Promise<{ word: string; saved: boolean }> {
  return apiRequest<{ word: string; saved: boolean }>(
    `/dictionary/saves/${encodeURIComponent(word)}`,
    { method: 'POST', token },
  );
}
```

`DictionarySection` interface болон `saveWord()` функц энэ файлаас **бүрмөсөн алга болно**.

- [ ] **Step 2: Commit**

```bash
git add mobile/src/api/dictionary.ts
git commit -m "feat(mobile): толины search/saves API + WordSense төрөл"
```

(Энэ алхмын дараа `DictionaryProvider.tsx` түр компайл болохгүй — Task 10-д засна.)

---

## Task 10: Mobile — хайлтын карт

**Files:**
- Modify: `mobile/src/components/DictionaryProvider.tsx`
- Modify: `mobile/src/i18n/index.ts`

- [ ] **Step 1: i18n мөрүүд нэм**

`mobile/src/i18n/index.ts` — монгол блокод (`clearHistory`-ийн дэргэд):

```ts
  dictionaryWords: 'Тольны үгс',
  lessonWords: 'Хичээлийн үгс',
  noSensesFound: 'Энэ үгийн утга олдсонгүй.',
  openInDictionary: 'Тольноос харах',
```

Англи блокод (мөр ~1701-ийн дэргэд):

```ts
  dictionaryWords: 'Dictionary words',
  lessonWords: 'Lesson words',
  noSensesFound: 'No meanings found for this word.',
  openInDictionary: 'Open in dictionary',
```

- [ ] **Step 2: Import + context-ийг өргөтгө**

`mobile/src/components/DictionaryProvider.tsx` дээд талд, api import блокыг:

```ts
import {
  lookupWord,
  translateSentence,
  getWordAudio,
  searchWord,
  getDictionarySaves,
  toggleDictionarySave,
  type WordLookup,
  type WordSense,
} from '../api/dictionary';
```

`DictionaryState` interface-д нэмнэ:

```ts
interface DictionaryState {
  /** Look a word up and open the popover anchored above the tap point. */
  lookup: (word: string, anchor: Anchor) => void;
  /** Translate a full sentence/phrase and open the popover above the anchor. */
  translatePhrase: (text: string, anchor: Anchor) => void;
  /** Open the in-place search overlay (transparent — no screen change). */
  openSearch: () => void;
  /** Open the full Толь card for a word (used by the Saved-words screen). */
  openWordCard: (word: string) => void;
}
```

- [ ] **Step 3: ⭐ төлөвийг нэг эх сурвалжаас удирд**

`DictionaryProvider` дотор одоо байгаа `saved`/`saveBusy` state-ийг дараахаар **сольж** тавина (файлын state блокод):

```ts
  // Every word this user has starred, loaded once. Both the reader popover and
  // the Толь card read their ⭐ state from here, so the star is never wrong on
  // first open (the old code always started un-starred).
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [saveBusy, setSaveBusy] = useState(false);

  // Толь search card state (separate from the tap popover — different layout).
  const [cardWord, setCardWord] = useState<string | null>(null);
  const [cardSenses, setCardSenses] = useState<WordSense[] | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
```

Хуучин `const [saved, setSaved] = useState(false);` мөрийг устгасны дараа
`setSaved(false)` гэсэн дуудалтууд **`lookup()` болон `translatePhrase()`
callback дотор үлдэнэ** — тэдгээрийг мөн устга (компайлер заана). ⭐ төлөв одоо
дуудлага бүрт reset болохгүй, `savedWords` олонлогоос уншигдана.

⭐ жагсаалтыг ачаалах effect (recents-ийн effect-ийн доор):

```ts
  // Load the ⭐ list once per session. Deliberately not refreshed afterwards:
  // if an admin deletes an entry mid-session the star stays until restart, which
  // is the same cache semantics the rest of the dictionary already has.
  useEffect(() => {
    if (!token) return;
    getDictionarySaves(token)
      .then((rows) => setSavedWords(new Set(rows.map((r) => r.word))))
      .catch(() => {});
  }, [token]);
```

- [ ] **Step 4: `save()`-ыг toggle болго**

Одоогийн `save` callback-ийг бүтнээр сольж:

```ts
  // ⭐ toggle. Goes to `user_dictionary_saves` — never to the curated word bank.
  const toggleStar = useCallback(
    async (raw: string) => {
      const w = raw.trim().toLowerCase();
      if (!w || !token || saveBusy) return;
      setSaveBusy(true);
      try {
        const { saved: isSaved } = await toggleDictionarySave(token, w);
        setSavedWords((prev) => {
          const next = new Set(prev);
          if (isSaved) next.add(w);
          else next.delete(w);
          return next;
        });
      } catch {
        // leave the star as-is so the user can retry
      } finally {
        setSaveBusy(false);
      }
    },
    [token, saveBusy],
  );
```

Popover доторх ⭐ Pressable-ийг `onPress={() => toggleStar(word!)}`, дүрсийг
`name={savedWords.has(word ?? '') ? 'bookmark' : 'bookmark-outline'}` болгож засна.

- [ ] **Step 5: Дуудлагыг дахин ашиглаж болохоор гарга**

Одоогийн `speak` callback-ийн дээр нэм:

```ts
  /** Speak an English word: ElevenLabs clip if we have one, else device TTS. */
  const speakEnglish = useCallback(
    async (w: string, knownUrl?: string | null) => {
      const playUrl = (uri: string) => {
        try {
          player.replace({ uri });
          player.play();
          return true;
        } catch {
          return false;
        }
      };
      if (knownUrl && playUrl(knownUrl)) return;
      if (token) {
        setAudioBusy(true);
        try {
          const { audioUrl } = await getWordAudio(token, w);
          if (playUrl(audioUrl)) return;
        } catch {
          // fall through to device TTS
        } finally {
          setAudioBusy(false);
        }
      }
      Speech.stop();
      Speech.speak(w, { language: 'en-US', rate: 0.9 });
    },
    [token, player],
  );
```

Одоогийн `speak`-ийг үүн дээр түшиглэж богиносго:

```ts
  const speak = useCallback(async () => {
    if (!word) return;
    // Sentences: read aloud with the on-device voice (no per-sentence ElevenLabs).
    if (isPhrase) {
      Speech.stop();
      Speech.speak(word, { language: 'en-US', rate: 0.9 });
      return;
    }
    await speakEnglish(word, result?.audioUrl);
  }, [word, isPhrase, result, speakEnglish]);
```

- [ ] **Step 6: Хайлтын картыг нээх функц**

```ts
  /** Open the Толь card for a word: 4 senses in a wide, scrollable sheet. */
  const openWordCard = useCallback(
    async (raw: string) => {
      const clean = raw.trim().toLowerCase();
      if (!clean || !token) return;
      setCardWord(clean);
      setCardSenses(null);
      setCardError(null);
      setCardLoading(true);
      haptics.select();
      try {
        const { senses } = await searchWord(token, clean);
        setCardSenses(senses);
      } catch (err) {
        setCardError(err instanceof ApiError ? err.message : t('noSensesFound'));
      } finally {
        setCardLoading(false);
      }
    },
    [token],
  );
```

`runSearch` доторх сүүлийн хоёр мөрийг (`const screen = …; lookup(clean, …);`) дараахаар сольж:

```ts
      openWordCard(clean);
```

`runSearch`-ийн dependency массивыг `[lookup]` → `[openWordCard]` болго.

Context value-г шинэчил:

```ts
  const value = useMemo(
    () => ({ lookup, translatePhrase, openSearch, openWordCard }),
    [lookup, translatePhrase, openSearch, openWordCard],
  );
```

- [ ] **Step 7: Картын Modal-ыг render хий**

Хайлтын overlay Modal-ийн **дараа**, popover Modal-ийн өмнө нэм:

```tsx
      {/* Толь card — the 4-sense search result. Wide + scrollable, unlike the
          260px tap popover, which cannot fit four 3-line senses. */}
      <Modal
        visible={!!cardWord}
        transparent
        animationType="fade"
        onRequestClose={() => setCardWord(null)}
      >
        <Pressable style={styles.cardBackdrop} onPress={() => setCardWord(null)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.cardHead}>
              <AppText variant="h3" style={styles.cardWord}>{cardWord}</AppText>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => cardWord && speakEnglish(cardWord)}
              >
                {audioBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="volume-high" size={22} color={colors.primary} />
                )}
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => cardWord && toggleStar(cardWord)}
              >
                {saveBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name={savedWords.has(cardWord ?? '') ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={savedWords.has(cardWord ?? '') ? colors.success : colors.primary}
                  />
                )}
              </Pressable>
            </View>

            {cardLoading ? (
              <ActivityIndicator style={styles.cardLoading} color={colors.primary} />
            ) : cardError ? (
              <AppText variant="body" color={colors.textMuted}>{cardError}</AppText>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(cardSenses ?? []).map((s, i) => (
                  <View key={i} style={styles.sense}>
                    <AppText variant="label" color={colors.primary}>
                      {i + 1}. {s.word}
                    </AppText>
                    <AppText variant="body">{s.example}</AppText>
                    <AppText variant="body" color={colors.textSecondary}>
                      {s.translation}
                    </AppText>
                  </View>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
```

- [ ] **Step 8: Стиль нэм**

`makeStyles(colors)` дотор:

```ts
  cardBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    maxHeight: '65%',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    ...elevation.float,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardWord: { flex: 1 },
  cardLoading: { paddingVertical: spacing.xl },
  sense: { marginBottom: spacing.lg, gap: 2 },
```

`elevation.float` бол энэ файлын popover-ийн аль хэдийн хэрэглэдэг түлхүүр
(`DictionaryProvider.tsx:499`), тиймээс шинэ import хэрэггүй.

- [ ] **Step 9: Хуучин `sections` блокыг устга**

`DictionaryProvider.tsx:406` орчмын

```tsx
              {/* Richer 4-part explanation, when the backend provides it (doc §2). */}
              {result.sections && result.sections.length > 0 ? ( … ) : null}
```

блокыг **бүтнээр устга**, мөн `makeStyles`-ээс `sections` ба `section` стилийг устга.

- [ ] **Step 10: Типүүд цэвэр эсэхийг батал**

```bash
cd mobile && npx tsc --noEmit
```

Хүлээгдэх: алдаагүй.

- [ ] **Step 11: Гараар шалга (Expo Go)**

```bash
cd mobile && npm run go
```

1. Нүүр дээрх 🔍 → `run` бичээд хайх → **өргөн карт, 1–4 дугаартай утга** гарна.
2. 🔊 → дуудлага сонсогдоно. ⭐ → дүрс өнгө солино.
3. Аппыг хаагаад дахин нээ → тэр үгийг дахин хай → **шууд** гарч ирнэ (cache).
4. Унших материал → үг дээр **давхар дар** → **хуучин жижиг popover** хэвээр,
   4 утга гарахгүй.

- [ ] **Step 12: Commit**

```bash
git add mobile/src/components/DictionaryProvider.tsx mobile/src/i18n/index.ts
git commit -m "feat(mobile): толины хайлтын карт — 4 утга, ⭐ шинэ endpoint рүү"
```

---

## Task 11: Mobile — Хадгалсан үгс 2 хэсэгтэй болгох

**Files:**
- Modify: `mobile/app/saved.tsx`

- [ ] **Step 1: Толины хэсгийг ачаал**

`mobile/app/saved.tsx`-ийн import блокод нэм:

```tsx
import {
  getDictionarySaves,
  toggleDictionarySave,
  type SavedDictionaryWord,
} from '../src/api/dictionary';
import { useDictionary } from '../src/components/DictionaryProvider';
```

`SavedScreen` дотор state + `load()`-д нэмэлт:

```tsx
  const [dictWords, setDictWords] = useState<SavedDictionaryWord[]>([]);
  const { openWordCard } = useDictionary();
```

`load` callback дотор, `getReviewStats(...)` мөрийн дэргэд:

```tsx
    // Толь saves are a separate list — a failure there must not blank the
    // curated words above it.
    getDictionarySaves(token).then(setDictWords).catch(() => {});
```

- [ ] **Step 2: Толины мөрийн компонент**

`saved.tsx`-ийн доод хэсэгт (`makeStyles`-ийн өмнө):

```tsx
/**
 * One ⭐ dictionary word. Tapping opens the full Толь card; the star removes it.
 * No flashcard practice here — these rows have no image, level or SM-2 state.
 */
const DictRow = memo(function DictRow({
  row,
  colors: c,
  onOpen,
  onUnsave,
}: {
  row: SavedDictionaryWord;
  colors: AppColors;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText variant="label">{row.word}</AppText>
          {row.translation ? (
            <AppText variant="caption" color={c.textSecondary} numberOfLines={1}>
              {row.translation}
            </AppText>
          ) : null}
        </View>
        <IconButton
          icon="book-outline"
          size={38}
          variant="filled"
          iconColor={c.primary}
          accessibilityLabel={t('openInDictionary')}
          onPress={onOpen}
        />
        <IconButton
          icon="bookmark"
          size={38}
          variant="filled"
          iconColor={c.xp}
          accessibilityLabel={t('removeFromSaved')}
          onPress={onUnsave}
        />
      </View>
    </Card>
  );
});
```

`IconButton`-ийн `accessibilityLabel` нь **заавал** (эс бөгөөс компайл алдаа),
тиймээс `openInDictionary` түлхүүрийг Task 10 Step 1-д нэмсэн i18n мөрүүд дээр
нэмж бич: монгол `'Тольноос харах'`, англи `'Open in dictionary'`.
`removeFromSaved` нь аль хэдийн байгаа (`saved.tsx:199`).

- [ ] **Step 3: FlatList-д хоёр хэсгийг холбо**

`FlatList`-д нэмнэ:

```tsx
        ListHeaderComponent={
          words.length > 0 ? (
            <AppText variant="overline" color={c.textMuted} style={{ marginBottom: spacing.sm }}>
              {t('lessonWords')}
            </AppText>
          ) : null
        }
        ListFooterComponent={
          dictWords.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              <AppText variant="overline" color={c.textMuted} style={{ marginBottom: spacing.sm }}>
                {t('dictionaryWords')}
              </AppText>
              {dictWords.map((row) => (
                <DictRow
                  key={row.word}
                  row={row}
                  colors={c}
                  onOpen={() => openWordCard(row.word)}
                  onUnsave={async () => {
                    if (!token) return;
                    await toggleDictionarySave(token, row.word);
                    setDictWords((prev) => prev.filter((r) => r.word !== row.word));
                  }}
                />
              ))}
            </View>
          ) : null
        }
```

Одоогийн `ListHeaderComponent`/`ListFooterComponent` байвал тэдгээрийн доторх
агуулгыг устгалгүй, дээрхийг нэмж нэгтгэ.

Хоосон төлөв: `EmptyState` нь одоо `words.length === 0` дээр гардаг бол
`words.length === 0 && dictWords.length === 0` болгож засна.

- [ ] **Step 4: Типүүд + гараар шалга**

```bash
cd mobile && npx tsc --noEmit
```

Expo Go дээр: толиноос ⭐ дар → Хадгалсан үгс дэлгэц нээ → **Тольны үгс** хэсэгт
гарч ирнэ → 📖 дарвал карт нээгдэнэ → ⭐ дарвал жагсаалтаас алга болно.
**Хичээлийн үгс** хэсгийн flashcard дасгал урьдын адил ажиллана.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/saved.tsx
git commit -m "feat(mobile): Хадгалсан үгс — хичээлийн + тольны хоёр хэсэг"
```

---

## Task 12: Багт зарлах + эцсийн шалгалт

**Files:**
- Modify: `CLAUDE.md` (Current Status хэсэгт шинэ догол)

- [ ] **Step 1: `CLAUDE.md`-д зарлал нэм**

"Current Status" хэсэгт, хамгийн сүүлийн огнооны блокын дараа:

```markdown
**AI Толь — 4 утгатай хайлт + тусдаа толины сан (2026-08-03).** Search icon-оор
хайсан үг одоо хэрэглээний давтамжаар эрэмбэлсэн **хамгийн ихдээ 4 утга** (үг ·
англи жишээ · монгол орчуулга) буцаана — `GET /dictionary/search/:word`, шинэ
`dictionary_entries` санд үүрд cache-лэгдэнэ. Admin-д шинэ **"Толь"** цэс
(`/dictionary`) нэмэгдэж, утгыг гараар засах/устгах боломжтой.
⚠️ **Choi/Boju:** `POST /dictionary/:word/save` **устсан** — ⭐ одоо
`POST /dictionary/saves/:word` (toggle) бөгөөд `words` банкинд `needs_review` мөр
**үүсгэхээ больсон**. `mobile/src/api/dictionary.ts`-ээс `saveWord()` ба
`DictionarySection` төрөл алга болсон; оронд нь `searchWord()` /
`getDictionarySaves()` / `toggleDictionarySave()` + `WordSense`.
`useDictionary()` context-д `openWordCard(word)` нэмэгдсэн. Унших дэлгэцийн
давхар-дарах popover **өөрчлөгдөөгүй**. Шинэ хүснэгтүүд prod-д migration
`CreateDictionaryEntries1786500000000`-оор орно. Дэлгэрэнгүй: `API.md` §11.
```

- [ ] **Step 2: Бүх шалгалтыг ажиллуул**

```bash
cd backend && npx tsc --noEmit -p tsconfig.json && npm run lint && npm test
cd ../admin && npx tsc --noEmit && npm run build
cd ../mobile && npx tsc --noEmit
```

Хүлээгдэх: бүгд алдаагүй.

- [ ] **Step 3: e2e (Postgres + Redis асаалттай)**

```bash
cd backend && npm run test:e2e
```

Хүлээгдэх: бүх багц PASS.

- [ ] **Step 4: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: AI Толь-ын өөрчлөлтийг багт зарлав"
git push origin usukhbayar
```

⚠️ PR нээх (`gh pr create`) нь **Өсөхбаярын тодорхой зөвшөөрлийг** шаардана —
өөрөө бүү нээ.

---

## Хэрэгжүүлэлтийн дараах гараар шалгах жагсаалт

- [ ] Mobile: 🔍 → `run` → 4 утга, дугаарлагдсан, гарчиг/шошгогүй
- [ ] Mobile: ижил үгийг дахин хайхад **шууд** (AI дуудалтгүй)
- [ ] Mobile: унших материал → давхар дарах → **жижиг popover, 1 утга** хэвээр
- [ ] Mobile: ⭐ → Хадгалсан үгс → "Тольны үгс" хэсэгт гарна
- [ ] Admin: Толь цэс → хайсан үг мөрөөр гарна, Хайлт багана өснө
- [ ] Admin: Засах → хадгалах → "✏️ зассан", mobile дээр зассан утга гарна
- [ ] DB: `SELECT count(*) FROM words WHERE status = 'needs_review'` — толиноос
      ⭐ дарсны дараа **өсөхгүй**
