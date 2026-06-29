import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, In, IsNull, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Idiom } from '../entities/idiom.entity';
import { CreateIdiomDto } from './dto/create-idiom.dto';
import { UpdateIdiomDto } from './dto/update-idiom.dto';
import { QueryIdiomDto } from './dto/query-idiom.dto';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { geminiRetryDelayMs } from '../words/words.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface PaginatedIdioms {
  items: Idiom[];
  total: number;
  page: number;
  limit: number;
}

/** Live progress of a background bulk-image job. */
export interface IdiomImageJob {
  total: number;
  processed: number;
  ok: number;
  failed: number;
  done: boolean;
}

/** Text fields the AI fills for an idiom (admin reviews before saving). */
export interface IdiomAiFill {
  mongolian: string;
  meaning: string;
  definition: string;
  exampleSentence: string;
  exampleTranslation: string;
}

/** Idioms CRUD + AI fill (Gemini) + pronunciation audio (ElevenLabs). */
@Injectable()
export class IdiomsService {
  private readonly logger = new Logger(IdiomsService.name);
  /** In-memory bulk-image job progress, keyed by jobId (single instance — MVP). */
  private readonly imageJobs = new Map<string, IdiomImageJob>();

  constructor(
    private readonly config: ConfigService,
    private readonly aiGateway: AiGatewayService,
    @InjectRepository(Idiom) private readonly idioms: Repository<Idiom>,
  ) {}

  async create(dto: CreateIdiomDto): Promise<Idiom> {
    const idiom = this.idioms.create({
      phrase: dto.phrase,
      mongolian: dto.mongolian,
      meaning: dto.meaning ?? null,
      definition: dto.definition ?? null,
      exampleSentence: dto.exampleSentence ?? null,
      exampleTranslation: dto.exampleTranslation ?? null,
      imageUrl: dto.imageUrl ?? null,
      audioUrl: dto.audioUrl ?? null,
      isPublished: dto.isPublished ?? false,
    });
    return this.idioms.save(idiom);
  }

  async findAll(query: QueryIdiomDto): Promise<PaginatedIdioms> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const where: Record<string, unknown>[] = [];

    const base: Record<string, unknown> = {};
    if (!query.all) base.isPublished = true;
    if (query.noImage) base.imageUrl = IsNull();

    if (query.search) {
      // search over phrase OR mongolian (keep the published gate on both)
      where.push({ ...base, phrase: ILike(`%${query.search}%`) });
      where.push({ ...base, mongolian: ILike(`%${query.search}%`) });
    }

    const [items, total] = await this.idioms.findAndCount({
      where: where.length ? where : base,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, total, page, limit };
  }

  async findOne(id: string): Promise<Idiom> {
    const idiom = await this.idioms.findOne({ where: { id } });
    if (!idiom) throw new NotFoundException('Хэлц олдсонгүй');
    return idiom;
  }

  async update(id: string, dto: UpdateIdiomDto): Promise<Idiom> {
    const idiom = await this.findOne(id);
    Object.assign(idiom, {
      ...(dto.phrase !== undefined && { phrase: dto.phrase }),
      ...(dto.mongolian !== undefined && { mongolian: dto.mongolian }),
      ...(dto.meaning !== undefined && { meaning: dto.meaning }),
      ...(dto.definition !== undefined && { definition: dto.definition }),
      ...(dto.exampleSentence !== undefined && { exampleSentence: dto.exampleSentence }),
      ...(dto.exampleTranslation !== undefined && { exampleTranslation: dto.exampleTranslation }),
      ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
      ...(dto.audioUrl !== undefined && { audioUrl: dto.audioUrl }),
      ...(dto.isPublished !== undefined && { isPublished: dto.isPublished }),
    });
    return this.idioms.save(idiom);
  }

  async remove(id: string): Promise<void> {
    const idiom = await this.findOne(id);
    await this.idioms.remove(idiom);
  }

  /** Bulk-edit selected idioms (e.g. publish/unpublish many at once). */
  async bulkUpdate(
    ids: string[],
    changes: { isPublished?: boolean },
  ): Promise<{ updated: number }> {
    if (!ids.length) return { updated: 0 };
    const res = await this.idioms.update({ id: In(ids) }, changes);
    return { updated: res.affected ?? 0 };
  }

  /** Generate an illustrative image (OpenAI) for one idiom; caches the URL. */
  async generateImage(id: string, userId: string): Promise<{ imageUrl: string }> {
    const idiom = await this.findOne(id);
    const { imageUrl } = await this.aiGateway.generateVocabularyImage({
      userId,
      wordId: id,
      english: idiom.phrase,
      mongolian: idiom.meaning ?? idiom.mongolian,
      partOfSpeech: 'idiom',
      exampleSentence: idiom.exampleSentence,
    });
    idiom.imageUrl = imageUrl;
    await this.idioms.save(idiom);
    return { imageUrl };
  }

  // ── Bulk image generation (background, like Words) ──────────────────────────

  /** Start a background job that generates images for selected idioms. */
  startBulkImages(ids: string[], userId: string): string {
    const jobId = randomUUID();
    const job: IdiomImageJob = {
      total: ids.length, processed: 0, ok: 0, failed: 0, done: false,
    };
    this.imageJobs.set(jobId, job);
    this.runBulkImages(ids, userId, job)
      .catch((e) => this.logger.error(`[idiom images] job ${jobId} crashed: ${e?.message ?? e}`))
      .finally(() => {
        job.done = true;
        setTimeout(() => this.imageJobs.delete(jobId), 5 * 60_000);
      });
    return jobId;
  }

  getImageJob(jobId: string): IdiomImageJob | undefined {
    return this.imageJobs.get(jobId);
  }

  private async runBulkImages(ids: string[], userId: string, job: IdiomImageJob): Promise<void> {
    // Pace OpenAI image calls in parallel batches (default 5/sec) like Words.
    const mode = String(this.config.get('IMAGE_RATE_MODE') ?? 'normal').toLowerCase();
    const preset =
      mode === 'safe' ? { batch: 1, interval: 1_000 }
      : mode === 'low' ? { batch: 1, interval: 10_000 }
      : { batch: 5, interval: 1_000 };
    const BATCH = Number(this.config.get('OPENAI_IMAGE_BATCH') ?? preset.batch);
    const INTERVAL = Number(this.config.get('OPENAI_IMAGE_BATCH_INTERVAL_MS') ?? preset.interval);

    const processOne = async (id: string) => {
      try {
        await this.generateImage(id, userId);
        job.ok++;
      } catch (e) {
        job.failed++;
        this.logger.error(`[idiom images] failed ${id}: ${(e as Error)?.message}`);
      } finally {
        job.processed++;
      }
    };

    for (let i = 0; i < ids.length; i += BATCH) {
      const start = Date.now();
      await Promise.all(ids.slice(i, i + BATCH).map(processOne));
      const elapsed = Date.now() - start;
      if (i + BATCH < ids.length && elapsed < INTERVAL) await sleep(INTERVAL - elapsed);
    }
  }

  /** Generate pronunciation audio (ElevenLabs) for an idiom, cache the URL. */
  async generateAudio(id: string, userId: string): Promise<{ audioUrl: string }> {
    const idiom = await this.findOne(id);
    const { audioUrl } = await this.aiGateway.generateSpeechAudio({
      text: idiom.phrase,
      userId,
      filenameBase: `idiom-${id}`,
    });
    idiom.audioUrl = audioUrl;
    await this.idioms.save(idiom);
    return { audioUrl };
  }

  /**
   * Ask Gemini to fill an idiom's text fields from the phrase. Returns the
   * fields (NOT persisted) so the admin can review/edit before saving.
   */
  async aiFill(phrase: string): Promise<IdiomAiFill> {
    const clean = phrase.trim();
    if (!clean) throw new InternalServerErrorException('phrase хоосон байна');

    const prompt =
      `"${clean}" гэсэн англи хэлц (idiom)-ийн мэдээллийг бөглө.\n` +
      'ЗӨВХӨН JSON буцаа (markdown fence бүү тавь):\n' +
      '{\n' +
      '  "mongolian": "<хэлцийн монгол дүйцэл/орчуулга>",\n' +
      '  "meaning": "<жинхэнэ дүрслэл утга, монголоор 1 өгүүлбэр>",\n' +
      '  "definition": "<хэрэглээ/тайлбар, монголоор богино>",\n' +
      '  "exampleSentence": "<хэлцийг ашигласан богино англи өгүүлбэр>",\n' +
      '  "exampleTranslation": "<жишээ өгүүлбэрийн монгол орчуулга>"\n' +
      '}';

    const raw = await this.callGeminiJson(prompt);
    try {
      const clean2 = raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
      return JSON.parse(clean2) as IdiomAiFill;
    } catch {
      this.logger.error(`idiom ai-fill: unparseable: ${raw.slice(0, 200)}`);
      throw new InternalServerErrorException('AI хариуг уншиж чадсангүй');
    }
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
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
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
      this.logger.error(`Gemini idiom ai-fill failed (${response.status}): ${body}`);
      throw new InternalServerErrorException('AI бөглөхөд алдаа гарлаа');
    }
  }
}
