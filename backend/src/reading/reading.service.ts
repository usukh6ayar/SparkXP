import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import {
  ReadingPassage,
  ReadingSentence,
} from '../entities/reading-passage.entity';
import { CreateReadingDto } from './dto/create-reading.dto';
import { UpdateReadingDto } from './dto/update-reading.dto';
import { QueryReadingDto } from './dto/query-reading.dto';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { XpService } from '../xp/xp.service';
import { XpSource } from '../common/enums';
import { geminiRetryDelayMs } from '../words/words.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Average adult reading speed (words per minute) for the time estimate. */
const WORDS_PER_MINUTE = 200;

/** XP awarded the first time a student finishes a passage. */
const READING_XP = 15;

/** A page of results plus the total count, for the paginated list endpoint. */
export interface PaginatedReading {
  items: ReadingPassage[];
  total: number;
  page: number;
  limit: number;
}

/** One AI-generated "guess the meaning" item (F1, before admin review). */
export interface GuessChoice {
  word: string;
  correctMeaning: string;
  /** 3 Mongolian options; one equals correctMeaning at correctIndex. */
  choices: string[];
  correctIndex: number;
}

/** Live progress of a background sentence-audio job. */
export interface AudioJob {
  passageId: string;
  total: number;
  processed: number;
  failed: number;
  done: boolean;
}

/**
 * Reading passages CRUD + AI guess-choices (F1) + sentence audio (F4) + XP on
 * completion. Mirrors the Words module's publish-gating, Gemini and background
 * job patterns.
 */
@Injectable()
export class ReadingService {
  private readonly logger = new Logger(ReadingService.name);
  /** In-memory audio-job progress, keyed by jobId (single instance — MVP). */
  private readonly audioJobs = new Map<string, AudioJob>();

  constructor(
    private readonly config: ConfigService,
    private readonly aiGateway: AiGatewayService,
    private readonly xp: XpService,
    @InjectRepository(ReadingPassage)
    private readonly passages: Repository<ReadingPassage>,
  ) {}

  /**
   * Split raw passage text into sentences on `.`/`?`/`!` boundaries. A rough
   * MVP splitter — the admin always edits the resulting list by hand, so we
   * don't try to be perfect about abbreviations/decimals.
   */
  splitIntoSentences(text: string): ReadingSentence[] {
    if (!text?.trim()) return [];
    const parts = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*/g);
    if (!parts) return [];
    return parts
      .map((s) => s.trim())
      .filter(Boolean)
      .map((sentence, index) => ({ index, text: sentence, audioUrl: null }));
  }

  /** Count words across all sentences. */
  private countWords(sentences: ReadingSentence[]): number {
    return sentences.reduce((sum, s) => {
      const words = s.text.trim().split(/\s+/).filter(Boolean);
      return sum + words.length;
    }, 0);
  }

  /** Re-number sentences 0..n and recompute word count + reading time. */
  private normalize(passage: ReadingPassage): void {
    passage.sentences = (passage.sentences ?? []).map((s, index) => ({
      ...s,
      index,
      audioUrl: s.audioUrl ?? null,
    }));
    passage.wordCount = this.countWords(passage.sentences);
    passage.estimatedReadingTime = Math.ceil(
      (passage.wordCount / WORDS_PER_MINUTE) * 60,
    );
  }

  async create(dto: CreateReadingDto): Promise<ReadingPassage> {
    const passage = this.passages.create({
      title: dto.title,
      cefr: dto.cefr,
      coverImageUrl: dto.coverImageUrl ?? null,
      keyVocab: dto.keyVocab ?? [],
      sentences: (dto.sentences ?? []) as ReadingSentence[],
      isPublished: dto.isPublished ?? false,
    });
    this.normalize(passage);
    return this.passages.save(passage);
  }

  async findAll(query: QueryReadingDto): Promise<PaginatedReading> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string, unknown> = {};

    // Students only ever see published passages; admin passes all=true for drafts.
    if (!query.all) where.isPublished = true;
    if (query.cefr) where.cefr = query.cefr;
    if (query.search) where.title = ILike(`%${query.search}%`);

    const [items, total] = await this.passages.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<ReadingPassage> {
    const passage = await this.passages.findOne({ where: { id } });
    if (!passage) throw new NotFoundException('Унших материал олдсонгүй');
    return passage;
  }

  async update(id: string, dto: UpdateReadingDto): Promise<ReadingPassage> {
    const passage = await this.findOne(id);
    if (dto.title !== undefined) passage.title = dto.title;
    if (dto.cefr !== undefined) passage.cefr = dto.cefr;
    if (dto.coverImageUrl !== undefined) passage.coverImageUrl = dto.coverImageUrl;
    if (dto.keyVocab !== undefined) passage.keyVocab = dto.keyVocab;
    if (dto.sentences !== undefined)
      passage.sentences = dto.sentences as ReadingSentence[];
    if (dto.isPublished !== undefined) passage.isPublished = dto.isPublished;
    this.normalize(passage);
    return this.passages.save(passage);
  }

  async remove(id: string): Promise<void> {
    const passage = await this.findOne(id);
    await this.passages.remove(passage);
  }

  /**
   * Mark a passage complete for a student — awards XP once (idempotent via
   * XpLog source+referenceId). Re-completing earns nothing.
   */
  async complete(
    userId: string,
    passageId: string,
  ): Promise<{ passageId: string; alreadyCompleted: boolean; xpAwarded: number }> {
    await this.findOne(passageId); // 404 if missing
    const log = await this.xp.awardOnce({
      userId,
      amount: READING_XP,
      source: XpSource.READING,
      referenceId: passageId,
    });
    return {
      passageId,
      alreadyCompleted: log === null,
      xpAwarded: log ? READING_XP : 0,
    };
  }

  // ── F1: Guess Before Translate (admin review) ──────────────────────────────

  /**
   * Ask Gemini for a "guess the meaning" item per word: the correct Mongolian
   * meaning + 2 plausible decoys, shuffled, with the correct index. NOT
   * persisted — the admin reviews/edits the result then saves it into keyVocab.
   */
  async generateGuessChoices(words: string[], cefr?: string): Promise<GuessChoice[]> {
    const clean = words.map((w) => w.trim()).filter(Boolean);
    if (clean.length === 0) return [];

    const prompt =
      `Доорх англи үгс${cefr ? ` (CEFR ${cefr})` : ''}-т "утгыг таах" дасгал үүсгэ.\n` +
      'ЗӨВХӨН JSON массив буцаа (markdown fence бүү тавь):\n' +
      '[{ "word": "<англи үг>", "correctMeaning": "<зөв монгол утга>", ' +
      '"choices": ["<сонголт1>","<сонголт2>","<сонголт3>"], "correctIndex": <0-2> }]\n' +
      'Дүрэм: choices яг 3 монгол сонголттой; нэг нь correctMeaning (correctIndex дээр); ' +
      'нөгөө 2 нь логик боловч буруу (хэт ойлгомжтой биш). Үгс: ' +
      clean.join(', ');

    const raw = await this.callGeminiJson(prompt);
    let parsed: unknown;
    try {
      // responseMimeType=json → clean JSON; strip any stray fence just in case.
      const clean = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      this.logger.error(`guess-choices: unparseable AI output: ${raw.slice(0, 300)}`);
      throw new InternalServerErrorException('AI сонголтыг уншиж чадсангүй');
    }
    // Gemini sometimes wraps the array in an object ({ items: [...] }).
    const list: GuessChoice[] = Array.isArray(parsed)
      ? (parsed as GuessChoice[])
      : ((parsed as { items?: GuessChoice[]; choices?: GuessChoice[] })?.items ??
         (parsed as { results?: GuessChoice[] })?.results ??
         []);
    // Defensive clean-up: ensure 3 choices + a valid correctIndex.
    return list
      .filter((g) => g && g.word && Array.isArray(g.choices))
      .map((g) => ({
        word: g.word,
        correctMeaning: g.correctMeaning,
        choices: g.choices.slice(0, 3),
        correctIndex: Math.min(Math.max(g.correctIndex ?? 0, 0), 2),
      }));
  }

  // ── F4: Shadow Reading sentence audio (background) ──────────────────────────

  /** Start a background job that generates audio for every sentence; poll it. */
  startAudioJob(passageId: string, userId: string): string {
    const jobId = randomUUID();
    const job: AudioJob = { passageId, total: 0, processed: 0, failed: 0, done: false };
    this.audioJobs.set(jobId, job);

    this.runAudioJob(jobId, passageId, userId)
      .catch((e) => {
        this.logger.error(`[reading audio] job ${jobId} crashed: ${e?.message ?? e}`);
        job.done = true;
      })
      .finally(() => setTimeout(() => this.audioJobs.delete(jobId), 5 * 60_000));

    return jobId;
  }

  getAudioJob(jobId: string): AudioJob | undefined {
    return this.audioJobs.get(jobId);
  }

  private async runAudioJob(jobId: string, passageId: string, userId: string): Promise<void> {
    const job = this.audioJobs.get(jobId)!;
    const passage = await this.findOne(passageId);
    job.total = passage.sentences.length;

    for (const sentence of passage.sentences) {
      try {
        const { audioUrl } = await this.aiGateway.generateSpeechAudio({
          text: sentence.text,
          userId,
          filenameBase: `reading-${passageId}-${sentence.index}`,
        });
        sentence.audioUrl = audioUrl;
      } catch (e) {
        job.failed++;
        this.logger.warn(`[reading audio] sentence ${sentence.index} failed: ${(e as Error)?.message}`);
      }
      job.processed++;
      await sleep(200); // be gentle on the TTS API
    }

    await this.passages.save(passage);
    job.done = true;
  }

  /** Regenerate audio for a single sentence (synchronous). */
  async generateSentenceAudio(
    passageId: string,
    index: number,
    userId: string,
  ): Promise<{ index: number; audioUrl: string }> {
    const passage = await this.findOne(passageId);
    const sentence = passage.sentences.find((s) => s.index === index);
    if (!sentence) throw new NotFoundException('Өгүүлбэр олдсонгүй');

    const { audioUrl } = await this.aiGateway.generateSpeechAudio({
      text: sentence.text,
      userId,
      filenameBase: `reading-${passageId}-${index}`,
    });
    sentence.audioUrl = audioUrl;
    await this.passages.save(passage);
    return { index, audioUrl };
  }

  /** One Gemini call returning raw JSON text. Retries transient 429/503/overload. */
  private async callGeminiJson(prompt: string): Promise<string> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY тохируулаагүй байна');
    }
    const model = this.config.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const requestInit = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
      }),
    };

    const MAX_ATTEMPTS = 5;
    for (let attempt = 1; ; attempt++) {
      const response = await fetch(url, requestInit);
      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        };
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        return parts
          .filter((p) => !p.thought && p.text)
          .map((p) => p.text)
          .join('')
          .trim();
      }
      const body = await response.text().catch(() => '');
      const transient =
        response.status === 429 ||
        response.status === 503 ||
        (response.status === 404 &&
          /high demand|unavailable|overloaded|try again/i.test(body));
      if (transient && attempt < MAX_ATTEMPTS) {
        await sleep(geminiRetryDelayMs(body, attempt));
        continue;
      }
      this.logger.error(`Gemini guess-choices failed (${response.status}): ${body}`);
      throw new InternalServerErrorException('AI сонголт үүсгэхэд алдаа гарлаа');
    }
  }
}
