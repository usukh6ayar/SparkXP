/**
 * Generate small WebP thumbnails for the trophy badges and upload them to R2.
 *
 * The originals are ~2 MB PNGs — far too heavy for a mobile trophy grid. This
 * downloads each, resizes to 256px WebP (~20–40 KB), and uploads it to
 * `englishxp/media/trophy-thumb/<slug>.webp` (the `thumb` URL in the catalog).
 *
 * Idempotent-ish (overwrites the same keys). Run once after uploading badges:
 *   ts-node -r tsconfig-paths/register src/scripts/resize-trophies.ts
 *
 * Requires the R2 env (R2_ENDPOINT/ACCESS_KEY_ID/SECRET/BUCKET/PUBLIC_BASE_URL).
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { TROPHY_CATALOG } from '../achievements/catalog';

const SIZE = 256;
const CONCURRENCY = 10;
const R2 = {
  endpoint: process.env.R2_ENDPOINT ?? '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  bucket: process.env.R2_BUCKET ?? '',
  publicBase: (process.env.R2_PUBLIC_BASE_URL ?? '').replace(/\/$/, ''),
};

async function pool<T>(items: T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  const worker = async () => { while (i < items.length) await fn(items[i++]); };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
}

async function main() {
  if (!R2.endpoint || !R2.accessKeyId || !R2.secretAccessKey || !R2.bucket || !R2.publicBase) {
    console.error('✗ R2 env missing. Aborting.');
    process.exit(1);
  }
  const client = new S3Client({
    region: 'auto', endpoint: R2.endpoint,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });

  let done = 0, failed = 0;
  console.log(`Resizing ${TROPHY_CATALOG.length} trophies → ${SIZE}px WebP …`);
  await pool(TROPHY_CATALOG, CONCURRENCY, async (t) => {
    try {
      const res = await fetch(t.image);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      const png = Buffer.from(await res.arrayBuffer());
      const webp = await sharp(png)
        .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      await client.send(new PutObjectCommand({
        Bucket: R2.bucket,
        Key: `englishxp/media/trophy-thumb/${t.slug}.webp`,
        Body: webp,
        ContentType: 'image/webp',
      }));
      done++;
      if (done % 20 === 0) console.log(`  … ${done}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${t.slug}: ${e instanceof Error ? e.message : e}`);
    }
  });

  console.log(`\nDone. thumbs=${done} failed=${failed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
