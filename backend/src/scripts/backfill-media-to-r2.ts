/**
 * One-time backfill: move existing media from Cloudinary → Cloudflare R2 and
 * rewrite the stored URLs in the DB. Idempotent (skips URLs already on R2).
 *
 * SAFETY: dry-run by DEFAULT — it only reports. Pass `--execute` to actually
 * upload + update. ALWAYS take a `pg_dump` backup first.
 *
 * Usage:
 *   ts-node -r tsconfig-paths/register src/scripts/backfill-media-to-r2.ts            # dry-run, all
 *   ts-node ... backfill-media-to-r2.ts --tables=words,idioms --limit=50             # scoped dry-run
 *   ts-node ... backfill-media-to-r2.ts --execute                                    # DO IT (all)
 *
 * Requires R2 env: R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET, R2_PUBLIC_BASE_URL (+ optional R2_FOLDER, default englishxp/media).
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource, IsNull, Not } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { entities } from '../entities';
import { Word } from '../entities/word.entity';
import { Idiom } from '../entities/idiom.entity';
import { Lesson } from '../entities/lesson.entity';
import { Translation } from '../entities/translation.entity';
import { Message } from '../entities/message.entity';
import { BuddyVoiceCache } from '../entities/buddy-voice-cache.entity';
import { AiBuddy } from '../entities/ai-buddy.entity';
import { ReadingPassage } from '../entities/reading-passage.entity';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || 0;
const ONLY = (args.find((a) => a.startsWith('--tables='))?.split('=')[1] ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
// `--kind=audio` migrates ONLY audio (safe — no transforms). Images lose
// Cloudinary's f_auto/q_auto on R2, so default to audio-only unless --kind=all/image.
const KIND = (args.find((a) => a.startsWith('--kind='))?.split('=')[1] ?? 'audio') as
  'audio' | 'image' | 'all';
const wants = (k: 'image' | 'audio') => KIND === 'all' || KIND === k;

const R2 = {
  endpoint: process.env.R2_ENDPOINT ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.R2_BUCKET ?? '',
  publicBase: (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
  folder: process.env.R2_FOLDER || 'englishxp/media',
};

let client: S3Client;
const stats = { migrated: 0, skipped: 0, failed: 0 };

// Process this many assets concurrently (each = fetch + upload + save). Tune via
// BACKFILL_CONCURRENCY. ~16 turns a ~10h sequential run into ~30–45 min.
const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY ?? 16);

/** Run `fn` over `items` with a fixed-size worker pool. */
async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < items.length) await fn(items[i++]);
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** True if the URL still points at Cloudinary (i.e. needs migrating). */
function isCloudinary(url: string | null | undefined): url is string {
  return !!url && url.includes('res.cloudinary.com');
}

function extOf(url: string, kind: 'image' | 'audio'): string {
  const clean = url.split('?')[0];
  const m = /\.([a-z0-9]{2,4})$/i.exec(clean);
  if (m) return m[1].toLowerCase();
  return kind === 'audio' ? 'mp3' : 'jpg';
}

const CT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg',
};

/**
 * Download one Cloudinary asset and re-upload it to R2. Returns the new public
 * R2 URL, or null when nothing to do (already R2 / empty). Never throws — logs
 * and counts failures so one bad asset doesn't stop the run.
 */
async function migrate(url: string | null | undefined, kind: 'image' | 'audio', keyHint: string): Promise<string | null> {
  if (!url || url.trim() === '') return null;
  if (R2.publicBase && url.startsWith(R2.publicBase)) { stats.skipped++; return null; } // already R2
  if (!isCloudinary(url)) { stats.skipped++; return null; }

  const ext = extOf(url, kind);
  // Stable key from the source URL → re-runs overwrite the same object.
  const hash = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const key = `${R2.folder}/${kind}/${keyHint}-${hash}.${ext}`;
  const newUrl = `${R2.publicBase}/${key}`;

  if (!EXECUTE) { stats.migrated++; return newUrl; } // dry-run: pretend

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await client.send(new PutObjectCommand({
      Bucket: R2.bucket, Key: key, Body: buffer, ContentType: CT[ext] ?? 'application/octet-stream',
    }));
    stats.migrated++;
    if (stats.migrated % 500 === 0) console.log(`  … ${stats.migrated} migrated`);
    return newUrl;
  } catch (e) {
    stats.failed++;
    console.error(`  ✗ ${url} → ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

/** Migrate a simple table with string URL columns. */
async function backfillTable<T extends { id: string }>(
  ds: DataSource,
  name: string,
  entity: new () => T,
  fields: { col: keyof T; kind: 'image' | 'audio' }[],
): Promise<void> {
  if (ONLY.length && !ONLY.includes(name)) return;
  const cols = fields.filter((f) => wants(f.kind));
  if (!cols.length) return;
  const repo = ds.getRepository(entity);
  const where = cols.map((f) => ({ [f.col]: Not(IsNull()) }));
  const rows = await repo.find({ where: where as any, take: LIMIT || undefined });
  console.log(`\n▶ ${name}: ${rows.length} candidate rows`);
  await pool(rows, CONCURRENCY, async (row) => {
    let changed = false;
    for (const f of cols) {
      const cur = row[f.col] as unknown as string | null;
      const next = await migrate(cur, f.kind, `${name}-${row.id}-${String(f.col)}`);
      if (next) { (row as any)[f.col] = next; changed = true; }
    }
    if (changed && EXECUTE) await repo.save(row);
  });
}

/** Reading passages: coverImageUrl + per-sentence audioUrl inside the jsonb array. */
async function backfillReading(ds: DataSource): Promise<void> {
  if (ONLY.length && !ONLY.includes('reading_passages')) return;
  const repo = ds.getRepository(ReadingPassage);
  const rows = await repo.find({ take: LIMIT || undefined });
  console.log(`\n▶ reading_passages: ${rows.length} rows`);
  await pool(rows, CONCURRENCY, async (p) => {
    let changed = false;
    if (wants('image')) {
      const cover = await migrate(p.coverImageUrl, 'image', `reading-${p.id}-cover`);
      if (cover) { p.coverImageUrl = cover; changed = true; }
    }
    if (wants('audio')) {
      for (const s of p.sentences ?? []) {
        const a = await migrate(s.audioUrl, 'audio', `reading-${p.id}-s`);
        if (a) { s.audioUrl = a; changed = true; }
      }
    }
    if (changed && EXECUTE) await repo.save(p);
  });
}

async function main() {
  if (!R2.endpoint || !R2.accessKeyId || !R2.secretAccessKey || !R2.bucket || !R2.publicBase) {
    console.error('✗ R2 env missing (R2_ENDPOINT/ACCESS_KEY_ID/SECRET/BUCKET/PUBLIC_BASE_URL). Aborting.');
    process.exit(1);
  }
  client = new S3Client({
    region: 'auto', endpoint: R2.endpoint,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });

  console.log(`Cloudinary → R2 backfill · mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} · kind=${KIND}` +
    `${LIMIT ? ` · limit=${LIMIT}` : ''}${ONLY.length ? ` · tables=${ONLY.join(',')}` : ''}`);

  const ds = new DataSource(
    process.env.DATABASE_URL
      ? { type: 'postgres', url: process.env.DATABASE_URL, entities, synchronize: false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }
      : { type: 'postgres', host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432), username: process.env.DB_USERNAME ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres', database: process.env.DB_NAME ?? 'sparkxp',
          entities, synchronize: false },
  );
  await ds.initialize();
  try {
    await backfillTable(ds, 'words', Word, [
      { col: 'imageUrl', kind: 'image' }, { col: 'audioUrl', kind: 'audio' }]);
    await backfillTable(ds, 'idioms', Idiom, [
      { col: 'imageUrl', kind: 'image' }, { col: 'audioUrl', kind: 'audio' }]);
    await backfillTable(ds, 'lessons', Lesson, [{ col: 'thumbnailUrl', kind: 'image' }]);
    await backfillTable(ds, 'translations', Translation, [{ col: 'audioUrl', kind: 'audio' }]);
    await backfillTable(ds, 'buddy_voice_cache', BuddyVoiceCache, [{ col: 'audioUrl', kind: 'audio' }]);
    await backfillTable(ds, 'messages', Message, [{ col: 'audioUrl', kind: 'audio' }]);
    await backfillTable(ds, 'ai_buddies', AiBuddy, [{ col: 'avatarThumbUrl', kind: 'image' }]);
    await backfillReading(ds);
  } finally {
    await ds.destroy();
  }

  console.log(`\n=== Done (${EXECUTE ? 'EXECUTED' : 'DRY-RUN'}) ===`);
  console.log(`migrated=${stats.migrated} · skipped=${stats.skipped} · failed=${stats.failed}`);
  if (!EXECUTE) console.log('Re-run with --execute to actually move the files.');
}

main().catch((err) => { console.error('Backfill failed:', err); process.exit(1); });
