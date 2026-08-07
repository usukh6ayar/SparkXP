/**
 * Send one push notification to a device, to prove the pipeline works.
 *
 *   npm run test:push -- 'ExponentPushToken[xxxxxxxx]'
 *   npm run test:push                 # → every registered device in the DB
 *
 * Push has more moving parts than any other feature here — the device must
 * register a token, Expo must accept it, and Expo must hold valid APNs (iOS) /
 * FCM (Android) credentials. When a notification doesn't arrive, the useful
 * question is *which* of those failed, and Expo's response says so explicitly.
 * This prints that response instead of leaving you guessing.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config();

import { DataSource } from 'typeorm';
import { entities } from '../entities';
import { User } from '../entities/user.entity';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Railway hands out two connection strings and they are easy to mix up:
 * `DATABASE_URL` points at `postgres.railway.internal`, which only resolves
 * from inside Railway's own network, while `DATABASE_PUBLIC_URL` is the one a
 * laptop can reach. Failing with a raw DNS error here helps nobody.
 */
function assertReachable(url: string | undefined): void {
  if (!url?.includes('.railway.internal')) return;
  console.error(
    '❌ Энэ бол Railway-гийн ДОТООД хаяг — зөвхөн Railway дотроос холбогдоно.\n\n' +
      '   Railway → Postgres → Variables → `DATABASE_PUBLIC_URL`-ыг ашиглана уу:\n' +
      "   DATABASE_URL='<DATABASE_PUBLIC_URL>' npm run test:push",
  );
  process.exit(1);
}

/** Read every registered device token straight from the database. */
async function tokensFromDb(): Promise<{ token: string; who: string }[]> {
  const url = process.env.DATABASE_URL || undefined;
  assertReachable(url);

  // A remote Postgres (anything that isn't localhost) needs TLS; Railway's
  // proxy certificate is not in the local trust store, hence rejectUnauthorized.
  const remote = !!url && !/localhost|127\.0\.0\.1/.test(url);

  const ds = new DataSource({
    type: 'postgres',
    url,
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'sparkxp',
    ssl:
      remote || process.env.DB_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    entities,
  });
  await ds.initialize();
  try {
    const rows = await ds.getRepository(User).find({
      where: {},
      select: { id: true, username: true, expoPushToken: true, pushEnabled: true },
    });
    return rows
      .filter((u) => u.expoPushToken)
      .map((u) => ({
        token: u.expoPushToken as string,
        who: `${u.username ?? u.id}${u.pushEnabled ? '' : ' (мэдэгдэл унтраалттай)'}`,
      }));
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const arg = process.argv[2];
  const targets = arg
    ? [{ token: arg, who: 'гараар өгсөн' }]
    : await tokensFromDb();

  if (targets.length === 0) {
    console.error(
      '❌ Бүртгэгдсэн төхөөрөмж алга.\n' +
        '   Утсандаа нэвтэрч, зөвшөөрөл өгсөн эсэхээ шалгаарай.\n' +
        '   (Expo Go дээр push ажиллахгүй — dev эсвэл TestFlight build хэрэгтэй.)',
    );
    process.exit(1);
  }

  console.log(`${targets.length} төхөөрөмж рүү илгээж байна…\n`);

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      targets.map((t) => ({
        to: t.token,
        title: 'SparkXP тест 🦊',
        body: 'Мэдэгдэл ажиллаж байна! Дарж үзээрэй.',
        // The app reads `data` when the user taps a notification; sending it
        // here keeps the test honest about the real payload shape.
        data: { test: true },
      })),
    ),
  });

  const json = (await res.json()) as {
    data?: { status: string; message?: string; details?: { error?: string } }[];
    errors?: unknown;
  };

  if (json.errors) {
    console.error('❌ Expo татгалзлаа:', JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }

  json.data?.forEach((r, i) => {
    const t = targets[i];
    if (r.status === 'ok') {
      console.log(`✅ ${t.who}`);
      return;
    }
    console.log(`❌ ${t.who} — ${r.message ?? r.status}`);
    // These two cover almost every real failure.
    if (r.details?.error === 'DeviceNotRegistered') {
      console.log('   → апп устгагдсан эсвэл token хуучирсан. Дахин нэвтэрвэл шинэчлэгдэнэ.');
    }
    if (r.details?.error === 'MismatchSenderId') {
      console.log('   → FCM түлхүүр `google-services.json`-той өөр төслийнх байна.');
    }
  });

  console.log(
    '\nМэдэгдэл ирээгүй бол:\n' +
      '  1. Утасны Тохиргоо → SparkXP → Мэдэгдэл асаалттай эсэх\n' +
      '  2. iOS: Focus / Do Not Disturb унтраалттай эсэх\n' +
      '  3. Аппыг БҮРЭН хааж (swipe) дахин туршаарай — background зан төлөв өөр',
  );
}

main().catch((err) => {
  console.error('\n❌ Алдаа:', err instanceof Error ? err.message : err);
  process.exit(1);
});
