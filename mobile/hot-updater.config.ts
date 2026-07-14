/**
 * Hot Updater — OTA JS bundle deploy config (CodePush alternative).
 *
 * Storage: Cloudflare R2 · Metadata: Cloudflare D1 · Edge: Cloudflare Worker
 *
 * Auth modes:
 * 1) Wrangler OAuth API token only (default) — works with `npx wrangler login`
 *    token in `.env.hotupdater`. Slightly slower R2 uploads (CLI path).
 * 2) R2 S3 keys (faster) — set ACCESS_KEY + SECRET in `.env.hotupdater`;
 *    config auto-switches when both are non-empty.
 *
 * Deploy: npm run ota:deploy
 */
import { expo } from '@hot-updater/expo';
import { d1Database, r2Storage } from '@hot-updater/cloudflare';
import { config } from 'dotenv';
import { defineConfig } from 'hot-updater';

config({ path: '.env.hotupdater' });

const accountId = process.env.HOT_UPDATER_CLOUDFLARE_ACCOUNT_ID!;
const bucketName = process.env.HOT_UPDATER_CLOUDFLARE_R2_BUCKET_NAME!;
const apiToken = process.env.HOT_UPDATER_CLOUDFLARE_API_TOKEN!;
const accessKeyId = process.env.HOT_UPDATER_CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.HOT_UPDATER_CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();

const useS3 =
  Boolean(accessKeyId) &&
  Boolean(secretAccessKey) &&
  accessKeyId !== 'FILL_ME' &&
  secretAccessKey !== 'FILL_ME';

export default defineConfig({
  build: expo(),
  storage: useS3
    ? r2Storage({
        bucketName,
        accountId,
        credentials: {
          accessKeyId: accessKeyId!,
          secretAccessKey: secretAccessKey!,
        },
      })
    : r2Storage({
        bucketName,
        accountId,
        cloudflareApiToken: apiToken,
      }),
  database: d1Database({
    databaseId: process.env.HOT_UPDATER_CLOUDFLARE_D1_DATABASE_ID!,
    accountId,
    cloudflareApiToken: apiToken,
  }),
  updateStrategy: 'appVersion',
});
