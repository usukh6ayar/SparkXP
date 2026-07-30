/**
 * One-off: reorganise the R2 bucket from the legacy `englishxp/...` layout into
 * a by-purpose layout, and repoint the URLs stored in Postgres.
 *
 *   englishxp/media/img/    →  words/img/ · idioms/img/ · reading/cover/
 *   englishxp/media/audio/  →  words/audio/
 *   englishxp/words/        →  words/img/          (one stray file)
 *   englishxp/avatars/      →  users/avatars/
 *   buddy/                  →  buddy/models/
 *
 * The old flat `img/` folder mixes word, idiom and reading images, so the split
 * is driven by which DB column references a file — not by the key itself.
 * Because each (table, column) maps to exactly ONE destination prefix, the DB
 * side is a single UPDATE per column rather than 32k row updates.
 *
 * Safety properties:
 *   - Objects are COPIED, never moved or deleted. The old keys keep working, so
 *     the app stays up even if this dies halfway and rows are half-migrated.
 *   - Idempotent: rows already pointing at the new prefix are skipped, and a
 *     copy whose destination exists is not repeated.
 *   - Trophies are handled by `--trophies` (they live in catalog.ts, not the DB).
 *
 * Usage:
 *   npx ts-node -T src/scripts/reorganize-r2-layout.ts --dry-run
 *   npx ts-node -T src/scripts/reorganize-r2-layout.ts
 *   npx ts-node -T src/scripts/reorganize-r2-layout.ts --trophies
 *   npx ts-node -T src/scripts/reorganize-r2-layout.ts --verify
 */
import {
  S3Client,
  CopyObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { DataSource } from 'typeorm';
import 'dotenv/config';
import { entities } from '../entities';

interface Move {
  table: string;
  column: string;
  from: string;
  to: string;
}

/** Every legacy prefix that is referenced from the database. */
const MOVES: Move[] = [
  { table: 'words', column: 'image_url', from: 'englishxp/media/img/', to: 'words/img/' },
  { table: 'words', column: 'image_url', from: 'englishxp/words/', to: 'words/img/' },
  { table: 'words', column: 'audio_url', from: 'englishxp/media/audio/', to: 'words/audio/' },
  { table: 'idioms', column: 'image_url', from: 'englishxp/media/img/', to: 'idioms/img/' },
  { table: 'idioms', column: 'audio_url', from: 'englishxp/media/audio/', to: 'idioms/audio/' },
  { table: 'reading_passages', column: 'cover_image_url', from: 'englishxp/media/img/', to: 'reading/cover/' },
  { table: 'users', column: 'avatar_url', from: 'englishxp/avatars/', to: 'users/avatars/' },
  { table: 'ai_buddies', column: 'avatar_asset_url', from: 'buddy/', to: 'buddy/models/' },
];

/** Trophy badges are referenced from catalog.ts, so they get their own pass. */
const TROPHY_MOVES = [
  { from: 'englishxp/media/trophy-thumb/', to: 'trophies/thumb/', ext: '.webp' },
  { from: 'englishxp/media/trophy/', to: 'trophies/full/', ext: '.webp' },
  // The 1254px PNG masters are kept, just parked out of the serving path.
  { from: 'englishxp/media/trophy/', to: 'trophies/_src/', ext: '.png' },
];

const CONCURRENCY = 24;
const dryRun = process.argv.includes('--dry-run');

const need = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} тохируулаагүй байна (.env)`);
  return v;
};

const bucket = need('R2_BUCKET');
const publicBase = need('R2_PUBLIC_BASE_URL').replace(/\/$/, '');

const s3 = new S3Client({
  region: 'auto',
  endpoint: need('R2_ENDPOINT'),
  credentials: {
    accessKeyId: need('R2_ACCESS_KEY_ID'),
    secretAccessKey: need('R2_SECRET_ACCESS_KEY'),
  },
});

/** Matches the other scripts in this folder: TypeORM DataSource, not raw pg. */
async function db(): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    url: need('DATABASE_URL'),
    entities,
    synchronize: false,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();
  return ds;
}

/** URL → R2 key. Stored URLs are percent-encoded; keys are not. */
const keyFromUrl = (url: string): string =>
  decodeURIComponent(url.slice(publicBase.length + 1));

/** Runs `worker` over `items` with a fixed number of workers in flight. */
async function pooled<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) await worker(items[next++]);
    }),
  );
}

async function exists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function copy(oldKey: string, newKey: string): Promise<void> {
  await s3.send(
    new CopyObjectCommand({
      Bucket: bucket,
      // CopySource must be `bucket/key`, URL-encoded (keys contain spaces).
      CopySource: encodeURI(`${bucket}/${oldKey}`),
      Key: newKey,
    }),
  );
}

/**
 * Phase 1 — copy every DB-referenced object to its new prefix.
 * Returns the number of failures: phase 2 must NOT run if this is non-zero, or
 * rows would be repointed at keys that were never copied.
 */
async function copyReferenced(): Promise<number> {
  const ds = await db();
  let totalFailed = 0;

  for (const m of MOVES) {
    const rows: { url: string }[] = await ds.query(
      `SELECT DISTINCT ${m.column} AS url FROM ${m.table}
       WHERE ${m.column} LIKE $1`,
      [`${publicBase}/${m.from}%`],
    );
    if (!rows.length) {
      console.log(`  ${m.table}.${m.column}  ${m.from} → ${m.to}: 0`);
      continue;
    }

    let copied = 0;
    let skipped = 0;
    const failed: string[] = [];

    await pooled(rows, async ({ url }) => {
      const oldKey = keyFromUrl(url);
      const newKey = m.to + oldKey.slice(decodeURIComponent(m.from).length);
      try {
        if (dryRun) return;
        if (await exists(newKey)) {
          skipped++;
          return;
        }
        await copy(oldKey, newKey);
        copied++;
      } catch (err) {
        failed.push(`${oldKey}: ${(err as Error).message}`);
      }
    });

    console.log(
      `  ${m.table}.${m.column}  ${m.from} → ${m.to}: ${rows.length} мөр` +
        (dryRun ? '' : ` · хуулсан ${copied} · байсан ${skipped} · алдаа ${failed.length}`),
    );
    if (failed.length) console.error(`    ${failed.slice(0, 3).join('\n    ')}`);
    totalFailed += failed.length;
  }

  await ds.destroy();
  return totalFailed;
}

/** Phase 2 — repoint the stored URLs. One UPDATE per (table, column, prefix). */
async function repointDatabase(): Promise<void> {
  const ds = await db();
  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    for (const m of MOVES) {
      // Count first: TypeORM returns [rows, affected] for UPDATE, so reading a
      // row count off the update result is ambiguous. A plain SELECT is not.
      const [{ n }]: { n: string }[] = await qr.query(
        `SELECT count(*)::int AS n FROM ${m.table} WHERE ${m.column} LIKE $1`,
        [`${publicBase}/${m.from}%`],
      );
      await qr.query(
        `UPDATE ${m.table}
            SET ${m.column} = replace(${m.column}, $1, $2)
          WHERE ${m.column} LIKE $3`,
        [`/${m.from}`, `/${m.to}`, `${publicBase}/${m.from}%`],
      );
      console.log(`  ${m.table}.${m.column}: ${n} мөр${dryRun ? ' (DRY RUN)' : ''}`);
    }
    if (dryRun) {
      await qr.rollbackTransaction();
      console.log('  [DRY RUN] ROLLBACK — DB өөрчлөгдөөгүй.');
    } else {
      await qr.commitTransaction();
    }
  } catch (err) {
    await qr.rollbackTransaction();
    throw err;
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

/** Trophies live in catalog.ts, so copy them by listing R2 rather than the DB. */
async function moveTrophies(): Promise<void> {
  for (const t of TROPHY_MOVES) {
    let token: string | undefined;
    const keys: string[] = [];
    do {
      const r = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, Prefix: t.from, ContinuationToken: token }),
      );
      for (const o of r.Contents ?? []) {
        // `trophy/` also contains the thumb folder's siblings — filter by ext.
        if (o.Key && o.Key.endsWith(t.ext)) keys.push(o.Key);
      }
      token = r.NextContinuationToken;
    } while (token);

    let copied = 0;
    let skipped = 0;
    await pooled(keys, async (oldKey) => {
      const newKey = t.to + oldKey.slice(t.from.length);
      if (dryRun) return;
      if (await exists(newKey)) {
        skipped++;
        return;
      }
      await copy(oldKey, newKey);
      copied++;
    });
    console.log(
      `  ${t.from}*${t.ext} → ${t.to}: ${keys.length} файл` +
        (dryRun ? '' : ` · хуулсан ${copied} · байсан ${skipped}`),
    );
  }
}

/** Reads every stored URL back and confirms it is publicly fetchable. */
async function verify(): Promise<void> {
  const ds = await db();
  let ok = 0;
  const bad: string[] = [];

  for (const m of MOVES) {
    const rows: { url: string }[] = await ds.query(
      `SELECT DISTINCT ${m.column} AS url FROM ${m.table} WHERE ${m.column} LIKE $1`,
      [`${publicBase}/${m.to}%`],
    );
    await pooled(rows, async ({ url }) => {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) ok++;
      else bad.push(`${res.status} ${url}`);
    });
    console.log(`  ${m.table}.${m.column}: ${rows.length} шалгав`);
  }

  console.log(`\n200 буцаасан: ${ok} · алдаатай: ${bad.length}`);
  if (bad.length) console.error(bad.slice(0, 10).join('\n'));
  await ds.destroy();
}

async function main(): Promise<void> {
  if (process.argv.includes('--verify')) return verify();

  if (process.argv.includes('--trophies')) {
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Трофей:`);
    return moveTrophies();
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Фаз 1 — R2 объект хуулах:`);
  const failed = await copyReferenced();

  if (failed > 0) {
    console.error(
      `\n⛔ ${failed} объект хуулагдсангүй. DB-г ХӨНДӨӨГҮЙ — эс бөгөөс байхгүй ` +
        `файл руу заасан URL үүснэ. Алдааг зассны дараа дахин ажиллуул ` +
        `(хуулагдсаныг нь алгасна).`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Фаз 2 — DB дэх URL солих:`);
  await repointDatabase();

  console.log(
    dryRun
      ? '\n[DRY RUN] Юу ч өөрчлөгдөөгүй.'
      : '\nДууслаа. Дараа нь: --verify, дараа нь --trophies',
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
