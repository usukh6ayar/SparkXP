/**
 * Migrate word/idiom/lesson/buddy IMAGES from Cloudinary → Cloudflare R2.
 *
 * The originals are ~1.5 MB PNGs. Instead of copying those (and losing
 * Cloudinary's on-the-fly f_auto/q_auto that R2 lacks), we fetch an
 * ALREADY-OPTIMIZED delivery (f_webp,q_auto,w_512 ≈ 40 KB) and upload that to
 * R2, then rewrite the DB URL. So mobile gets a small pre-optimized WebP with
 * ~40× less migration bandwidth.
 *
 * SAFETY: dry-run by DEFAULT. Pass `--execute` to actually move + rewrite.
 * ALWAYS take a `pg_dump` backup first. Idempotent (skips already-R2 URLs).
 *
 *   ts-node -r tsconfig-paths/register src/scripts/migrate-images-to-r2.ts            # dry-run
 *   ts-node ... migrate-images-to-r2.ts --tables=words --limit=20                      # scoped
 *   ts-node ... migrate-images-to-r2.ts --execute                                      # DO IT
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource, IsNull, Not } from 'typeorm';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { entities } from '../entities';
import { Word } from '../entities/word.entity';
import { Idiom } from '../entities/idiom.entity';
import { Lesson } from '../entities/lesson.entity';
import { AiBuddy } from '../entities/ai-buddy.entity';
import { ReadingPassage } from '../entities/reading-passage.entity';

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 0) || 0;
const ONLY = (args.find((a) => a.startsWith('--tables='))?.split('=')[1] ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);
const WIDTH = Number(process.env.IMG_WIDTH ?? 512);
const CONCURRENCY = Number(process.env.BACKFILL_CONCURRENCY ?? 16);

const R2 = {
  endpoint: process.env.R2_ENDPOINT ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.R2_BUCKET ?? '',
  publicBase: (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
};

let client: S3Client;
const stats = { migrated: 0, skipped: 0, failed: 0 };

function isCloudinary(u: string | null | undefined): u is string {
  return !!u && u.includes('res.cloudinary.com');
}

/** Ask Cloudinary for an optimized ~512px WebP instead of the big original. */
function optimized(url: string): string {
  return url.replace('/upload/', `/upload/f_webp,q_auto,w_${WIDTH}/`);
}

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

/** Fetch the optimized WebP for a Cloudinary image and upload to R2. */
async function migrate(url: string | null | undefined, key: string): Promise<string | null> {
  if (!url) return null;
  if (R2.publicBase && url.startsWith(R2.publicBase)) { stats.skipped++; return null; }
  if (!isCloudinary(url)) { stats.skipped++; return null; }

  const newUrl = `${R2.publicBase}/${key}`;
  if (!EXECUTE) { stats.migrated++; return newUrl; }

  try {
    const res = await fetch(optimized(url));
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await client.send(new PutObjectCommand({
      Bucket: R2.bucket, Key: key, Body: buffer, ContentType: 'image/webp',
    }));
    stats.migrated++;
    if (stats.migrated % 500 === 0) console.log(`  … ${stats.migrated} migrated`);
    return newUrl;
  } catch (e) {
    stats.failed++;
    console.error(`  ✗ ${url}: ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function backfillTable<T extends { id: string }>(
  ds: DataSource, name: string, entity: new () => T, col: keyof T,
): Promise<void> {
  if (ONLY.length && !ONLY.includes(name)) return;
  const repo = ds.getRepository(entity);
  const rows = await repo.find({ where: { [col]: Not(IsNull()) } as any, take: LIMIT || undefined });
  console.log(`\n▶ ${name}.${String(col)}: ${rows.length} rows`);
  await pool(rows, CONCURRENCY, async (row) => {
    const next = await migrate(row[col] as unknown as string, `englishxp/media/img/${name}/${row.id}.webp`);
    if (next && EXECUTE) { (row as any)[col] = next; await repo.save(row); }
  });
}

async function backfillReadingCovers(ds: DataSource): Promise<void> {
  if (ONLY.length && !ONLY.includes('reading_passages')) return;
  const repo = ds.getRepository(ReadingPassage);
  const rows = await repo.find({ where: { coverImageUrl: Not(IsNull()) }, take: LIMIT || undefined });
  console.log(`\n▶ reading_passages.coverImageUrl: ${rows.length} rows`);
  await pool(rows, CONCURRENCY, async (p) => {
    const next = await migrate(p.coverImageUrl, `englishxp/media/img/reading/${p.id}.webp`);
    if (next && EXECUTE) { p.coverImageUrl = next; await repo.save(p); }
  });
}

async function main() {
  if (!R2.endpoint || !R2.accessKeyId || !R2.secretAccessKey || !R2.bucket || !R2.publicBase) {
    console.error('✗ R2 env missing. Aborting.');
    process.exit(1);
  }
  client = new S3Client({
    region: 'auto', endpoint: R2.endpoint,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
  console.log(`Cloudinary images → R2 · mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'} · w=${WIDTH}` +
    `${LIMIT ? ` · limit=${LIMIT}` : ''}${ONLY.length ? ` · tables=${ONLY.join(',')}` : ''}`);

  const ds = new DataSource(
    process.env.DATABASE_URL
      ? { type: 'postgres', url: process.env.DATABASE_URL, entities, synchronize: false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }
      : { type: 'postgres', host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432), username: process.env.DB_USERNAME ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres', database: process.env.DB_NAME ?? 'englishxp',
          entities, synchronize: false },
  );
  await ds.initialize();
  try {
    await backfillTable(ds, 'words', Word, 'imageUrl');
    await backfillTable(ds, 'idioms', Idiom, 'imageUrl');
    await backfillTable(ds, 'lessons', Lesson, 'thumbnailUrl');
    await backfillTable(ds, 'ai_buddies', AiBuddy, 'avatarThumbUrl');
    await backfillReadingCovers(ds);
  } finally {
    await ds.destroy();
  }

  console.log(`\n=== Done (${EXECUTE ? 'EXECUTED' : 'DRY-RUN'}) ===`);
  console.log(`migrated=${stats.migrated} · skipped=${stats.skipped} · failed=${stats.failed}`);
  if (!EXECUTE) console.log('Re-run with --execute to actually move the images.');
}

main().catch((err) => { console.error('Image migration failed:', err); process.exit(1); });
