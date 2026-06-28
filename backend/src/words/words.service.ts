import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Repository, ILike, In, IsNull } from 'typeorm';
import { Word } from '../entities/word.entity';
import { WordReview } from '../entities/word-review.entity';
import { WordStatus, XpSource, SparksSource, ContentLevel } from '../common/enums';
import { XpService } from '../xp/xp.service';
import { SparksService } from '../sparks/sparks.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { CreateWordDto } from './dto/create-word.dto';
import { UpdateWordDto } from './dto/update-word.dto';
import { QueryWordsDto } from './dto/query-words.dto';
import { QuizAnswerDto } from './dto/quiz.dto';

export interface ImportReport {
  total: number;
  inserted: number;
  skipped: number;
  errors: { row: number; field: string; message: string }[];
  duplicates: { row: number; word: string }[];
  missingImage: string[];
  missingAudio: string[];
}

/** Content-health counts for the admin words dashboard. */
export interface WordStats {
  total: number;
  byStatus: Record<WordStatus, number>;
  missingImage: number;
  missingAudio: number;
  missingMnExample: number;
  duplicates: number;
}

/** One row in the learning-analytics lists. */
export interface WordStat {
  wordId: string;
  english: string;
  wrong: number;
  correct: number;
  saved: number;
  learners: number;
  difficulty: number;
}

/** Learning analytics over WordReview for the admin monitor. */
export interface WordAnalytics {
  topForgotten: WordStat[];
  topSaved: WordStat[];
  topKnown: WordStat[];
  hardest: WordStat[];
  avgSaveRate: number;
}

/** Result of a bulk AI-fill import (CSV of bare English words → ready cards). */
export interface AiBulkReport {
  requested: number;
  inserted: number;
  skipped: number;
  failed: { word: string; message: string }[];
  // Live progress (for the background media path the admin polls). `total` is
  // the deduped word count; `processed` counts finished words; `done` flips true
  // when the whole batch is finished.
  total: number;
  processed: number;
  done: boolean;
  // Flipped by cancelBulkJob() when the admin presses "Зогсоох". The job loops
  // check this between batches and stop early (in-flight items still finish).
  canceled?: boolean;
}

export interface AiFillResult {
  mongolian: string;
  englishDefinition: string;
  phonetic: string;
  partOfSpeech: string;
  category: string;
  level: string;
  exampleSentence: string;
  exampleTranslation: string;
  synonyms: string;
  antonyms: string;
  imageUrl: string | null;
}

/** A page of results plus the total count, for paginated list endpoints. */
export interface PaginatedWords {
  items: Word[];
  total: number;
  page: number;
  limit: number;
}

/** One multiple-choice question for the vocabulary quiz (no answer leaked). */
export interface QuizQuestion {
  wordId: string;
  english: string;
  phonetic: string | null;
  imageUrl: string | null;
  /** 4 Mongolian options, shuffled — one is correct. Graded server-side. */
  options: string[];
}

/** Result of grading a submitted vocabulary quiz. */
export interface QuizResult {
  total: number;
  correct: number;
  xpAwarded: number;
  sparksAwarded: number;
}

/** Reward per correct answer (anti-abuse: only correct answers earn). */
const XP_PER_CORRECT = 5;
const SPARKS_PER_CORRECT = 1;

/** RFC-4180 CSV line splitter — respects quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; }
    else if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += line[i]; }
  }
  result.push(cur);
  return result;
}

/** Fisher–Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * URL-safe key from an English word: lowercase, trimmed, spaces/punctuation → `_`.
 * Used to auto-match bulk-uploaded media filenames (`abandon.mp3` → "abandon").
 */
export function slugify(english: string): string {
  return english
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Claude sometimes wraps JSON in ```json … ``` fences despite instructions.
 * Strip them (and any leading/trailing prose) so JSON.parse succeeds.
 */
/** Coerce an AI-suggested level string to a valid ContentLevel (fallback A1). */
export function normalizeLevel(level?: string): ContentLevel {
  const v = (level ?? '').trim().toLowerCase();
  return (Object.values(ContentLevel) as string[]).includes(v)
    ? (v as ContentLevel)
    : ContentLevel.A1;
}

export function stripJsonFences(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();
  // Fall back to the outermost { … } if there's surrounding text.
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * How long to wait before retrying a Gemini call. Gemini's 429 body often
 * carries a RetryInfo ("retryDelay":"6s" / "Please retry in 6.2s"); honour it,
 * otherwise fall back to exponential backoff (2s, 4s, 8s…) capped at 30s.
 */
export function geminiRetryDelayMs(body: string, attempt: number): number {
  const m = body.match(/retry(?:Delay)?["\s:]+["']?(\d+(?:\.\d+)?)s/i);
  const suggested = m ? Math.ceil(parseFloat(m[1]) * 1000) : 0;
  const backoff = Math.min(2000 * 2 ** (attempt - 1), 30000);
  return Math.max(suggested, backoff);
}

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name);

  /**
   * Live progress of background AI-bulk jobs, keyed by jobId. In-memory (single
   * instance) — fine for MVP. The admin polls getBulkJob() to show a %.
   */
  private readonly bulkJobs = new Map<string, AiBulkReport>();

  constructor(
    @InjectRepository(Word)
    private readonly words: Repository<Word>,
    @InjectRepository(WordReview)
    private readonly reviews: Repository<WordReview>,
    private readonly xp: XpService,
    private readonly sparks: SparksService,
    private readonly aiGateway: AiGatewayService,
    private readonly config: ConfigService,
  ) {}

  // ── AI Fill (admin "✨ AI бөглөх" button) ──────────────────────────────────

  /**
   * Generate all TEXT fields from just the English word (interactive "AI бөглөх").
   * No image here on purpose: the image is generated exactly once at save time
   * (with the full word context for a better prompt). Generating a throwaway
   * preview image on every click wasted OpenAI credits + Cloudinary storage.
   */
  async aiFill(english: string): Promise<AiFillResult> {
    // A couple of quick retries ride out a brief 503 "high demand" blip without
    // spinning ~30s like the bulk path.
    const text = await this.fillText(english, 3);
    return { ...text, imageUrl: null };
  }

  /**
   * Bulk "AI fill": take a list of English words and, for each new one, let AI
   * generate every field (+ optional image) and save it — so a CSV of bare
   * English words becomes a set of ready vocabulary cards.
   *
   * Runs with limited concurrency (AI is slow); duplicates are skipped and
   * per-word failures are collected rather than aborting the whole batch.
   */
  /** Start a background AI-bulk job and return its id; poll getBulkJob() for %. */
  startAiBulk(
    rawWords: string[],
    generateImages = false,
    generateAudios = false,
  ): string {
    const jobId = randomUUID();
    const report: AiBulkReport = {
      requested: 0, inserted: 0, skipped: 0, failed: [],
      total: 0, processed: 0, done: false,
    };
    this.bulkJobs.set(jobId, report);
    void this.aiBulkImport(rawWords, generateImages, generateAudios, report)
      .catch((e) => this.logger.error(`[AI bulk] job ${jobId} crashed: ${e?.message ?? e}`))
      .finally(() => {
        report.done = true;
        // Keep the finished result around briefly so the admin can read the
        // final counts, then free the memory.
        setTimeout(() => this.bulkJobs.delete(jobId), 5 * 60_000);
      });
    return jobId;
  }

  /** Live progress/result of a background AI-bulk job (undefined if unknown). */
  getBulkJob(jobId: string): AiBulkReport | undefined {
    return this.bulkJobs.get(jobId);
  }

  /**
   * Request cancellation of a running bulk job. The loops check `canceled`
   * between batches and stop early; items already in flight finish normally.
   * Returns false if the job id is unknown (already finished/expired).
   */
  cancelBulkJob(jobId: string): boolean {
    const job = this.bulkJobs.get(jobId);
    if (!job) return false;
    job.canceled = true;
    this.logger.log(`[bulk] cancel requested for job ${jobId}`);
    return true;
  }

  /**
   * Start a background job that generates image and/or audio for a set of
   * EXISTING words (selected by checkbox in the admin). Returns a jobId to poll.
   * Image calls are throttled because OpenAI caps image generation per minute.
   */
  startBulkMedia(
    wordIds: string[],
    image: boolean,
    audio: boolean,
    userId: string,
  ): string {
    const jobId = randomUUID();
    const report: AiBulkReport = {
      requested: wordIds.length, inserted: 0, skipped: 0, failed: [],
      total: wordIds.length, processed: 0, done: false,
    };
    this.bulkJobs.set(jobId, report);
    void this.runBulkMedia(wordIds, image, audio, userId, report)
      .catch((e) => this.logger.error(`[media bulk] job ${jobId} crashed: ${e?.message ?? e}`))
      .finally(() => {
        report.done = true;
        setTimeout(() => this.bulkJobs.delete(jobId), 5 * 60_000);
      });
    return jobId;
  }

  private async runBulkMedia(
    wordIds: string[],
    image: boolean,
    audio: boolean,
    userId: string,
    report: AiBulkReport,
  ): Promise<void> {
    // Images go through Replicate (openai/gpt-image-2), which queues requests
    // itself. Target ~5 requests/second: PARALLEL batches of 5 started ~1s
    // apart. No long delay needed anymore (the old 61s wait was for OpenAI's
    // 5/min cap). Tune via OPENAI_IMAGE_BATCH / OPENAI_IMAGE_BATCH_INTERVAL_MS.
    // Audio just rides along per word.
    const BATCH = Number(this.config.get('OPENAI_IMAGE_BATCH') ?? 5);
    const BATCH_INTERVAL_MS = Number(
      this.config.get('OPENAI_IMAGE_BATCH_INTERVAL_MS') ?? 1_000,
    );
    this.logger.log(
      `[media bulk] start: ${wordIds.length} words (image=${image}, audio=${audio}), batch=${BATCH}`,
    );

    const processOne = async (id: string) => {
      try {
        if (image) await this.generateImage(id, userId);
        if (audio) await this.generateAudio(id, userId);
        report.inserted++;
        this.logger.log(`[media bulk] ok ${id}`);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'медиа алдаа';
        report.failed.push({ word: id, message });
        this.logger.error(`[media bulk] failed ${id}: ${message}`);
      } finally {
        report.processed++;
      }
    };

    for (let i = 0; i < wordIds.length; i += BATCH) {
      if (report.canceled) {
        this.logger.log(`[media bulk] canceled at ${report.processed}/${report.total}`);
        break;
      }
      const batchStart = Date.now();
      await Promise.all(wordIds.slice(i, i + BATCH).map(processOne));
      // Pace batch *starts* to ~5/sec; if the batch already took longer than the
      // interval (image gen is slow), there's no wait at all.
      if (image && i + BATCH < wordIds.length && !report.canceled) {
        const wait = BATCH_INTERVAL_MS - (Date.now() - batchStart);
        if (wait > 0) {
          this.logger.log(`[media bulk] batch done, waiting ${wait}ms`);
          await sleep(wait);
        }
      }
    }
    this.logger.log(
      `[media bulk] done: ok=${report.inserted}, failed=${report.failed.length}`,
    );
  }

  async aiBulkImport(
    rawWords: string[],
    generateImages = false,
    generateAudios = false,
    report?: AiBulkReport,
  ): Promise<AiBulkReport> {
    const words = [...new Set(rawWords.map((w) => w.trim()).filter(Boolean))];
    // Reuse a caller-supplied report (background job holds a live reference) or
    // make a fresh one for the synchronous path.
    report = report ?? {
      requested: words.length, inserted: 0, skipped: 0, failed: [],
      total: words.length, processed: 0, done: false,
    };
    report.requested = words.length;
    report.total = words.length;
    // Always-on progress logs (visible in Railway prod logs too) so a slow
    // background run can be watched word-by-word.
    this.logger.log(
      `[AI bulk] start: ${words.length} words (images=${generateImages}, audios=${generateAudios})`,
    );

    const CONCURRENCY = 3;
    for (let i = 0; i < words.length; i += CONCURRENCY) {
      if (report.canceled) {
        this.logger.log(`[AI bulk] canceled at ${report.processed}/${report.total}`);
        break;
      }
      const batch = words.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (english) => {
          try {
            const dup = await this.words.findOne({
              where: { english: ILike(english) },
              select: { id: true },
            });
            if (dup) {
              report.skipped++;
              this.logger.log(`[AI bulk] skip "${english}" (already exists)`);
              return;
            }

            const text = await this.fillText(english);
            // Image + audio are slow and optional; run them together and never
            // let a media failure abort the whole word (text already succeeded).
            const [imageUrl, audioUrl] = await Promise.all([
              generateImages ? this.fillImage(english).catch(() => null) : null,
              generateAudios ? this.fillAudio(english).catch(() => null) : null,
            ]);

            await this.words.save(
              this.words.create({
                english,
                mongolian: text.mongolian,
                englishDefinition: text.englishDefinition,
                phonetic: text.phonetic,
                partOfSpeech: text.partOfSpeech,
                category: text.category,
                level: normalizeLevel(text.level),
                exampleSentence: text.exampleSentence,
                exampleTranslation: text.exampleTranslation,
                synonyms: text.synonyms,
                antonyms: text.antonyms,
                imageUrl,
                audioUrl,
                slug: slugify(english),
                // AI-generated cards go through review before going live.
                status: WordStatus.NEEDS_REVIEW,
              }),
            );
            report.inserted++;
            this.logger.log(
              `[AI bulk] inserted "${english}" (image=${imageUrl ? 'yes' : 'no'}, audio=${audioUrl ? 'yes' : 'no'})`,
            );
          } catch (e) {
            const message = e instanceof Error ? e.message : 'AI алдаа';
            report.failed.push({ word: english, message });
            this.logger.error(`[AI bulk] failed "${english}": ${message}`);
          } finally {
            report.processed++;
          }
        }),
      );
    }
    report.done = true;
    this.logger.log(
      `[AI bulk] done: inserted=${report.inserted}, skipped=${report.skipped}, failed=${report.failed.length}`,
    );
    return report;
  }

  /**
   * Generate every text field for a word from just the English term, via Google
   * Gemini. `maxAttempts` controls 429/503 retry depth: keep it low for the
   * interactive "AI бөглөх" button (fast feedback) and high for bulk import
   * (rides out the free-tier per-minute rate limit).
   */
  private async fillText(
    english: string,
    maxAttempts = 7,
  ): Promise<Omit<AiFillResult, 'imageUrl'>> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY тохируулаагүй байна');
    }
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');

    const prompt =
      `Generate complete vocabulary-card data for the English word "${english}".\n` +
      'Return ONLY valid JSON (no markdown fences, no explanation):\n' +
      '{\n' +
      '  "mongolian": "<Mongolian meaning, e.g. Орхих, хаях>",\n' +
      '  "englishDefinition": "<short English definition, max 1 sentence>",\n' +
      '  "phonetic": "<IPA pronunciation incl. slashes, e.g. /əˈbændən/>",\n' +
      '  "partOfSpeech": "<noun|verb|adjective|adverb|phrase>",\n' +
      '  "category": "<one of: Daily Life, Business, Law, Medical, Engineering, Travel, Academic>",\n' +
      '  "level": "<CEFR level: a1|a2|b1|b2|c1|c2>",\n' +
      '  "exampleSentence": "<short natural English sentence using the word>",\n' +
      '  "exampleTranslation": "<Mongolian translation of the example sentence>",\n' +
      '  "synonyms": "<2-4 English synonyms, comma-separated; empty string if none>",\n' +
      '  "antonyms": "<1-3 English antonyms, comma-separated; empty string if none>"\n' +
      '}';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        // Ask Gemini to return raw JSON (no markdown fences).
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    };

    // Retry on rate-limit (429) / transient server errors (503) — important for
    // bulk import on the free tier, which throttles requests per minute.
    const MAX_ATTEMPTS = Math.max(1, maxAttempts);
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, requestInit);
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: {
            content?: { parts?: { text?: string; thought?: boolean }[] };
          }[];
        };
        // Pro/thinking models can return a "thought" part before the answer —
        // skip those and concatenate the real text parts.
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        const raw = parts
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join('')
          .trim();
        // Dev-only: dump the full Gemini response so you can see exactly what the
        // model generated (and spot anything extra). Quiet in production.
        if (this.config.get('NODE_ENV') !== 'production') {
          this.logger.log(`[AI] Gemini fillText("${english}") model=${model}`);
          this.logger.log(`[AI] Gemini RAW response: ${JSON.stringify(data)}`);
          this.logger.log(`[AI] Gemini parsed text: ${raw}`);
        }
        return JSON.parse(stripJsonFences(raw)) as Omit<AiFillResult, 'imageUrl'>;
      }

      const body = await response.text().catch(() => '');
      // Under load Gemini flaps between 429, 503 and even 404 — all carrying a
      // transient "high demand / unavailable" message. Retry those, but let a
      // genuine "model not found" 404 fail fast (don't mask a bad model name).
      const transient =
        response.status === 429 ||
        response.status === 503 ||
        (response.status === 404 && /high demand|unavailable|overloaded|try again/i.test(body));
      if (transient && attempt < MAX_ATTEMPTS) {
        const waitMs = geminiRetryDelayMs(body, attempt);
        this.logger.warn(
          `Gemini ${response.status} for "${english}" — retry ${attempt}/${MAX_ATTEMPTS - 1} in ${waitMs}ms`,
        );
        await sleep(waitMs);
        continue;
      }

      this.logger.error(`Gemini fill failed (${response.status}): ${body}`);
      throw new InternalServerErrorException('AI бөглөхөд алдаа гарлаа');
    }
  }

  private async fillImage(english: string): Promise<string | null> {
    const result = await this.aiGateway.generateVocabularyImage({
      userId: 'admin-fill',
      wordId: 'preview',
      english,
      mongolian: '',
      partOfSpeech: null,
    });
    return result.imageUrl;
  }

  private async fillAudio(english: string): Promise<string | null> {
    const result = await this.aiGateway.generateVocabularyAudio({
      userId: 'admin-fill',
      wordId: 'preview',
      english,
    });
    return result.audioUrl;
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: CreateWordDto, userId?: string): Promise<Word> {
    // Block duplicates — same English word (case-insensitive) can't be added twice.
    const duplicate = await this.words.findOne({
      where: { english: ILike(dto.english.trim()) },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('Энэ үг аль хэдийн бүртгэлтэй байна');
    }

    const { generateImage, generateAudio, ...wordFields } = dto;
    const word = this.words.create({ ...wordFields, slug: slugify(dto.english) });
    let saved = await this.words.save(word);
    if (generateImage && userId) saved = await this.generateImage(saved.id, userId);
    if (generateAudio && userId) saved = await this.generateAudio(saved.id, userId);
    return saved;
  }

  /**
   * List words with optional filters + pagination.
   * Defaults to `status = published` so the student app only ever sees live content.
   */
  async findAll(query: QueryWordsDto): Promise<PaginatedWords> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const base: Record<string, unknown> = {};
    // Student app: published only. Admin: explicit status, or `all` for every status.
    if (query.status) base.status = query.status;
    else if (!query.all) base.status = WordStatus.PUBLISHED;
    if (query.level) base.level = query.level;
    if (query.lessonId) base.lessonId = query.lessonId;
    if (query.category) base.category = query.category;
    // Media filters (admin): words missing an image / audio so they can be
    // selected in bulk and generated. Matches the getStats() "missing" counts.
    if (query.noImage) base.imageUrl = IsNull();
    if (query.noAudio) base.audioUrl = IsNull();

    // Duplicates filter (admin): keep only words whose English is shared with at
    // least one other word (case-insensitive). We resolve the duplicate ids in
    // one query, then constrain the normal find by them so all other filters
    // still apply. An empty set short-circuits to no results.
    if (query.duplicates) {
      const dupIds = await this.duplicateWordIds();
      if (dupIds.length === 0) return { items: [], total: 0, page, limit };
      base.id = In(dupIds);
    }

    const where = query.search
      ? [
          { ...base, english: ILike(`%${query.search}%`) },
          { ...base, mongolian: ILike(`%${query.search}%`) },
        ]
      : base;

    // For the duplicates view, group identical words next to each other so the
    // admin can eyeball each cluster; otherwise newest-first as usual.
    const order = query.duplicates
      ? ({ english: 'ASC', createdAt: 'ASC' } as const)
      : ({ createdAt: 'DESC' } as const);

    const [items, total] = await this.words.findAndCount({
      where,
      order,
      skip: (page - 1) * limit,
      take: limit,
    });

    return { items, total, page, limit };
  }

  /** Ids of every word that shares its English (lowercased) with another word. */
  private async duplicateWordIds(): Promise<string[]> {
    const rows = (await this.words.query(
      `SELECT id FROM words WHERE LOWER(english) IN (
         SELECT LOWER(english) FROM words GROUP BY LOWER(english) HAVING COUNT(*) > 1
       )`,
    )) as { id: string }[];
    return rows.map((r) => r.id);
  }

  /**
   * Delete duplicate words, keeping exactly one per English (case-insensitive).
   * The keeper is the "best" row in each group: published status wins, then the
   * one with the most media (image + audio), then the oldest. Deleting a word
   * cascades its WordReview rows (FK onDelete: CASCADE).
   */
  async deduplicate(): Promise<{ deleted: number; groups: number; kept: number }> {
    const dupIds = await this.duplicateWordIds();
    if (dupIds.length === 0) return { deleted: 0, groups: 0, kept: 0 };

    const words = await this.words.find({ where: { id: In(dupIds) } });

    // Group by lowercased English.
    const groups = new Map<string, Word[]>();
    for (const w of words) {
      const key = w.english.trim().toLowerCase();
      const list = groups.get(key);
      if (list) list.push(w);
      else groups.set(key, [w]);
    }

    // Higher score = better keeper.
    const score = (w: Word) =>
      (w.status === WordStatus.PUBLISHED ? 4 : 0) +
      (w.imageUrl ? 1 : 0) +
      (w.audioUrl ? 1 : 0);

    const toDelete: string[] = [];
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => {
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return a.createdAt.getTime() - b.createdAt.getTime(); // oldest first = keep
      });
      const [, ...rest] = list; // keep first, drop the rest
      toDelete.push(...rest.map((w) => w.id));
    }

    // Delete in chunks to keep the IN(...) list a sane size.
    for (let i = 0; i < toDelete.length; i += 500) {
      await this.words.delete({ id: In(toDelete.slice(i, i + 500)) });
    }

    return { deleted: toDelete.length, groups: groups.size, kept: groups.size };
  }

  /** Get one word or throw 404. */
  async findOne(id: string): Promise<Word> {
    const word = await this.words.findOne({ where: { id } });
    if (!word) throw new NotFoundException('Үг олдсонгүй');
    return word;
  }

  async update(id: string, dto: UpdateWordDto, userId?: string): Promise<Word> {
    const word = await this.findOne(id);
    const { generateImage, generateAudio, ...wordFields } = dto;
    Object.assign(word, wordFields);
    let saved = await this.words.save(word);
    if (generateImage && userId) saved = await this.generateImage(saved.id, userId);
    if (generateAudio && userId) saved = await this.generateAudio(saved.id, userId);
    return saved;
  }

  /** Generate and save an AI illustration for an existing word via OpenAI. */
  async generateImage(id: string, userId: string): Promise<Word> {
    const word = await this.findOne(id);
    const result = await this.aiGateway.generateVocabularyImage({
      userId,
      wordId: word.id,
      english: word.english,
      mongolian: word.mongolian,
      partOfSpeech: word.partOfSpeech,
      exampleSentence: word.exampleSentence,
      cefr: word.level,
    });
    word.imageUrl = result.imageUrl;
    return this.words.save(word);
  }

  /** Generate and save a pronunciation audio clip for an existing word via ElevenLabs. */
  async generateAudio(id: string, userId: string): Promise<Word> {
    const word = await this.findOne(id);
    const result = await this.aiGateway.generateVocabularyAudio({
      userId,
      wordId: word.id,
      english: word.english,
    });
    word.audioUrl = result.audioUrl;
    return this.words.save(word);
  }

  async remove(id: string): Promise<void> {
    const word = await this.findOne(id);
    await this.words.remove(word);
  }

  // ── Import v2 (with validation report) ────────────────────────────────────

  /**
   * Parse a CSV string and import words with a full validation report.
   * New words land as `needs_review` (not `published`) so they go through review.
   * Supported columns: word | english, mongolian_meaning | mongolian, level,
   *   part_of_speech, category, english_definition, english_example,
   *   mongolian_example, phonetic, image_url, audio_url.
   */
  async importCsv(csvText: string): Promise<ImportReport> {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) throw new BadRequestException('CSV хоосон байна');

    const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
    const dataRows = lines.slice(1).map((line, i) => {
      const vals = splitCsvLine(line);
      const obj: Record<string, string> = {};
      headers.forEach((h, j) => { obj[h] = (vals[j] ?? '').trim(); });
      return { rowNum: i + 2, obj };
    });

    const report: ImportReport = { total: dataRows.length, inserted: 0, skipped: 0, errors: [], duplicates: [], missingImage: [], missingAudio: [] };

    const validLevels = Object.values(ContentLevel) as string[];

    for (const { rowNum, obj } of dataRows) {
      const english = obj['word'] || obj['english'];
      const mongolian = obj['mongolian_meaning'] || obj['mongolian'];
      const levelRaw = (obj['level'] || 'a1').toLowerCase();

      if (!english) {
        report.errors.push({ row: rowNum, field: 'word', message: 'Англи үг хоосон байна' });
        report.skipped++; continue;
      }
      if (!mongolian) {
        report.errors.push({ row: rowNum, field: 'mongolian_meaning', message: 'Монгол утга хоосон байна' });
        report.skipped++; continue;
      }
      if (!validLevels.includes(levelRaw)) {
        report.errors.push({ row: rowNum, field: 'level', message: `Түвшин буруу: "${levelRaw}" (a1–c2 байх ёстой)` });
        report.skipped++; continue;
      }
      const level = levelRaw as ContentLevel;
      const sl = slugify(english);

      const exists = await this.words.findOne({ where: { slug: sl, level }, select: { id: true } });
      if (exists) { report.duplicates.push({ row: rowNum, word: english }); report.skipped++; continue; }

      const w = this.words.create({
        english, mongolian, slug: sl, level,
        partOfSpeech: obj['part_of_speech'] || undefined,
        category: obj['category'] || undefined,
        englishDefinition: obj['english_definition'] || undefined,
        exampleSentence: obj['english_example'] || undefined,
        exampleTranslation: obj['mongolian_example'] || undefined,
        phonetic: obj['phonetic'] || undefined,
        imageUrl: obj['image_url'] || undefined,
        audioUrl: obj['audio_url'] || undefined,
        status: WordStatus.NEEDS_REVIEW,
      });
      await this.words.save(w);
      report.inserted++;
      if (!w.imageUrl) report.missingImage.push(sl);
      if (!w.audioUrl) report.missingAudio.push(sl);
    }

    return report;
  }

  /**
   * Bulk-insert words, skipping any that already exist (same english + level).
   */
  async bulkImport(items: CreateWordDto[]): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;
    const BATCH = 100;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (dto) => {
          // Same English word (case-insensitive) can't be imported twice.
          const exists = await this.words.findOne({
            where: { english: ILike(dto.english.trim()) },
            select: { id: true },
          });
          if (exists) { skipped++; return; }
          const { generateImage: _gi, ...wordFields } = dto;
          await this.words.save(
            this.words.create({
              // Imports land for review unless the file sets an explicit status.
              status: WordStatus.NEEDS_REVIEW,
              ...wordFields,
              slug: slugify(dto.english),
            }),
          );
          inserted++;
        }),
      );
    }
    return { inserted, skipped };
  }

  // ── Admin: monitoring, bulk-edit, analytics ──────────────────────────────

  /** Content health counts for the admin dashboard. */
  async getStats(): Promise<WordStats> {
    const statuses = Object.values(WordStatus);
    const [total, statusCounts, missingImage, missingAudio, missingMnExample, dup] =
      await Promise.all([
        this.words.count(),
        Promise.all(statuses.map((s) => this.words.count({ where: { status: s } }))),
        this.words.count({ where: { imageUrl: IsNull() } }),
        this.words.count({ where: { audioUrl: IsNull() } }),
        this.words.count({ where: { exampleTranslation: IsNull() } }),
        this.words.query(
          `SELECT COUNT(*)::int AS c FROM (SELECT 1 FROM words GROUP BY LOWER(english) HAVING COUNT(*) > 1) t`,
        ) as Promise<{ c: number }[]>,
      ]);

    const byStatus = Object.fromEntries(
      statuses.map((s, i) => [s, statusCounts[i]]),
    ) as Record<WordStatus, number>;

    return {
      total,
      byStatus,
      missingImage,
      missingAudio,
      missingMnExample,
      duplicates: dup[0]?.c ?? 0,
    };
  }

  /** Alias for bulkUpdate — called by PATCH /words/bulk with raw body params. */
  async bulkEdit(
    ids: string[],
    changes: { status?: WordStatus; category?: string; level?: ContentLevel },
  ): Promise<{ updated: number }> {
    return this.bulkUpdate(ids, changes);
  }

  /** Apply the same change (status / category / level) to many words at once. */
  async bulkUpdate(
    ids: string[],
    changes: { status?: WordStatus; category?: string; level?: ContentLevel },
  ): Promise<{ updated: number }> {
    const patch: {
      status?: WordStatus;
      category?: string;
      level?: ContentLevel;
    } = {};
    if (changes.status) patch.status = changes.status;
    if (changes.category !== undefined) patch.category = changes.category;
    if (changes.level) patch.level = changes.level;
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Өөрчлөх утга алга байна');
    }
    await this.words.update({ id: In(ids) }, patch);
    return { updated: ids.length };
  }

  /** Learning analytics over WordReview — what students forget / save / know. */
  async getAnalytics(limit = 10): Promise<WordAnalytics> {
    const rows = await this.reviews
      .createQueryBuilder('r')
      .innerJoin(Word, 'w', 'w.id = r.word_id')
      .select('r.word_id', 'wordId')
      .addSelect('w.english', 'english')
      .addSelect('SUM(r.wrong_count)', 'wrong')
      .addSelect('SUM(r.correct_count)', 'correct')
      .addSelect('SUM(CASE WHEN r.saved THEN 1 ELSE 0 END)', 'saved')
      .addSelect('COUNT(*)', 'learners')
      .groupBy('r.word_id')
      .addGroupBy('w.english')
      .getRawMany();

    const data = rows.map((r) => {
      const wrong = Number(r.wrong) || 0;
      const correct = Number(r.correct) || 0;
      return {
        wordId: r.wordId as string,
        english: r.english as string,
        wrong,
        correct,
        saved: Number(r.saved) || 0,
        learners: Number(r.learners) || 0,
        difficulty: wrong + correct > 0 ? wrong / (wrong + correct) : 0,
      };
    });

    const top = (key: 'wrong' | 'saved' | 'correct') =>
      [...data].sort((a, b) => b[key] - a[key]).slice(0, limit);

    const totalSaved = data.reduce((s, d) => s + d.saved, 0);
    const totalLearners = data.reduce((s, d) => s + d.learners, 0);

    return {
      topForgotten: top('wrong'),
      topSaved: top('saved'),
      topKnown: top('correct'),
      hardest: [...data]
        .filter((d) => d.wrong + d.correct >= 3)
        .sort((a, b) => b.difficulty - a.difficulty)
        .slice(0, limit),
      avgSaveRate: totalLearners > 0 ? totalSaved / totalLearners : 0,
    };
  }

  // ── Vocabulary quiz ──────────────────────────────────────────────────────

  /**
   * Build a multiple-choice quiz from PUBLISHED words: each question shows an
   * English word and 4 Mongolian options (the correct meaning + 3 distractors).
   */
  async generateQuiz(count = 10): Promise<QuizQuestion[]> {
    const pool = await this.words
      .createQueryBuilder('w')
      .where('w.status = :status', { status: WordStatus.PUBLISHED })
      .andWhere("w.mongolian <> ''")
      .orderBy('RANDOM()')
      .limit(Math.max(count * 4, 40))
      .getMany();

    const uniqueMeanings = Array.from(new Set(pool.map((w) => w.mongolian)));
    if (uniqueMeanings.length < 4) {
      throw new BadRequestException('Сорил үүсгэхэд хангалттай нийтлэгдсэн үг алга байна');
    }

    const answers = pool.slice(0, Math.min(count, pool.length));
    return answers.map((word) => {
      const distractors = shuffle(uniqueMeanings.filter((m) => m !== word.mongolian)).slice(0, 3);
      return {
        wordId: word.id,
        english: word.english,
        phonetic: word.phonetic,
        imageUrl: word.imageUrl,
        options: shuffle([word.mongolian, ...distractors]),
      };
    });
  }

  /**
   * Grade submitted answers and award XP + Sparks for correct ones only.
   */
  async gradeQuiz(userId: string, answers: QuizAnswerDto[]): Promise<QuizResult> {
    if (answers.length === 0) throw new BadRequestException('Хариулт алга байна');

    const ids = [...new Set(answers.map((a) => a.wordId))];
    const wordList = await this.words.find({ where: { id: In(ids), status: WordStatus.PUBLISHED } });
    const byId = new Map(wordList.map((w) => [w.id, w]));

    let correct = 0;
    for (const a of answers) {
      const word = byId.get(a.wordId);
      if (word && a.choice.trim() === word.mongolian.trim()) correct++;
    }

    const xpAwarded = correct * XP_PER_CORRECT;
    const sparksAwarded = correct * SPARKS_PER_CORRECT;
    if (xpAwarded > 0) await this.xp.award({ userId, amount: xpAwarded, source: XpSource.QUIZ });
    if (sparksAwarded > 0) {
      await this.sparks.change({ userId, amount: sparksAwarded, source: SparksSource.QUIZ });
    }

    return { total: answers.length, correct, xpAwarded, sparksAwarded };
  }
}
