/**
 * One-off: re-encode the 100 trophy badges on R2 from PNG to WebP.
 *
 * The originals are 1254x1254 PNGs at ~1.7MB each (~163MB total). The identical
 * artwork at 640px WebP q80 is ~60KB (~5.8MB total) — 28x smaller, and 640px is
 * still sharp for a full-screen badge on a 3x DPR phone. Thumbnails in
 * `trophy-thumb/` are already WebP and are NOT touched.
 *
 * Objects are written to the SAME key with a `.webp` extension; the `.png`
 * originals are left in place so this is reversible. Re-run `--update-catalog`
 * (or edit catalog.ts) once the uploads are verified.
 *
 * Usage:
 *   npx ts-node -T src/scripts/optimize-trophy-images.ts --dry-run
 *   npx ts-node -T src/scripts/optimize-trophy-images.ts
 *   npx ts-node -T src/scripts/optimize-trophy-images.ts --update-catalog
 *
 * --dry-run downloads and converts but uploads nothing, so it needs no R2
 * credentials — only R2_PUBLIC_BASE_URL (or the built-in fallback) to read from.
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';
import 'dotenv/config';
import { TROPHY_CATALOG } from '../achievements/catalog';

/** Same default the API falls back to when R2_PUBLIC_BASE_URL is unset. */
const FALLBACK_BASE = 'https://pub-6b9eaedaf87348b0ab542274f72b5c96.r2.dev';
const WIDTH = 640;
const QUALITY = 80;

const dryRun = process.argv.includes('--dry-run');
const updateCatalog = process.argv.includes('--update-catalog');
const publicBase = (process.env.R2_PUBLIC_BASE_URL || FALLBACK_BASE).replace(/\/$/, '');

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

/** Rewrites the 100 `imagePath` extensions in catalog.ts from .png to .webp. */
function rewriteCatalog(): void {
  const file = join(__dirname, '..', 'achievements', 'catalog.ts');
  const src = readFileSync(file, 'utf8');
  const out = src.replace(
    /("imagePath": "[^"]+)\.png"/g,
    (_m, head: string) => `${head}.webp"`,
  );
  const changed = (src.match(/"imagePath": "[^"]+\.png"/g) ?? []).length;
  writeFileSync(file, out);
  console.log(`\ncatalog.ts: ${changed} зам .png → .webp`);
}

async function main(): Promise<void> {
  if (updateCatalog) {
    rewriteCatalog();
    return;
  }

  // Only built when we actually upload, so --dry-run needs no credentials.
  const client = dryRun
    ? null
    : new S3Client({
        region: 'auto',
        endpoint: required('R2_ENDPOINT'),
        credentials: {
          accessKeyId: required('R2_ACCESS_KEY_ID'),
          secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
        },
      });
  const bucket = dryRun ? '' : required('R2_BUCKET');

  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}${TROPHY_CATALOG.length} трофей · ${WIDTH}px WebP q${QUALITY}\nsource: ${publicBase}\n`,
  );

  let pngBytes = 0;
  let webpBytes = 0;
  const failed: string[] = [];

  for (const [i, trophy] of TROPHY_CATALOG.entries()) {
    // Skip anything already converted so the script is safe to re-run.
    if (!trophy.imagePath.endsWith('.png')) continue;
    const num = `${i + 1}/${TROPHY_CATALOG.length}`;

    try {
      const res = await fetch(`${publicBase}/${trophy.imagePath}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const png = Buffer.from(await res.arrayBuffer());

      const webp = await sharp(png)
        .resize(WIDTH, WIDTH, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer();

      pngBytes += png.length;
      webpBytes += webp.length;

      // decodeURIComponent: catalog paths are URL-encoded, S3 keys are not.
      const key = decodeURIComponent(trophy.imagePath).replace(/\.png$/, '.webp');
      if (client) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: webp,
            ContentType: 'image/webp',
          }),
        );
      }

      console.log(
        `  ${num} ${trophy.slug}: ${kb(png.length)} → ${kb(webp.length)}${dryRun ? '' : ' ✓'}`,
      );
    } catch (err) {
      failed.push(trophy.slug);
      console.error(`  ${num} ${trophy.slug}: АЛДАА — ${(err as Error).message}`);
    }
  }

  const done = TROPHY_CATALOG.length - failed.length;
  console.log(
    `\nБолсон: ${done} · Алдаа: ${failed.length}` +
      `\nНийт: ${kb(pngBytes)} → ${kb(webpBytes)}` +
      (webpBytes ? ` (${(pngBytes / webpBytes).toFixed(1)}x бага)` : ''),
  );
  if (failed.length) console.log(`Алдаатай: ${failed.join(', ')}`);
  if (dryRun) console.log('\n[DRY RUN] R2 руу юу ч бичээгүй.');
  else if (!failed.length)
    console.log('\nДараа нь: npx ts-node -T src/scripts/optimize-trophy-images.ts --update-catalog');
}

/** Fails loudly at startup instead of mid-upload when a var is missing. */
function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} тохируулаагүй байна (.env)`);
  return v;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
