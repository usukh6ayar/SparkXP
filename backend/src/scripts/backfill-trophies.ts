/**
 * One-off: award every trophy existing users have already earned.
 *
 * Without this, the first XP award after deploy would unlock a user's whole
 * accumulated history at once and the app would queue 20+ celebration modals.
 * Rows are inserted with `seen_at = now()` so the backlog lands silently; only
 * trophies won from here on get a celebration.
 *
 * Idempotent (`ON CONFLICT DO NOTHING`) — safe to re-run, and safe to re-run
 * after adding new conditions to the catalog.
 *
 * Usage:
 *   npx ts-node -T src/scripts/backfill-trophies.ts --dry-run
 *   npx ts-node -T src/scripts/backfill-trophies.ts
 */
import { NestFactory } from '@nestjs/core';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import 'dotenv/config';
import { AppModule } from '../app.module';
import { AchievementsService } from '../achievements/achievements.service';
import {
  ALWAYS_CHECKED,
  ConditionType,
  TYPES_BY_SOURCE,
} from '../achievements/conditions';
import { User } from '../entities/user.entity';
import { UserTrophy } from '../entities/user-trophy.entity';

const dryRun = process.argv.includes('--dry-run');

/** Every condition type in play — the backfill checks all of them at once. */
const ALL_TYPES: ConditionType[] = [
  ...new Set([...ALWAYS_CHECKED, ...Object.values(TYPES_BY_SOURCE).flat()]),
];

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const achievements = app.get(AchievementsService);
  const users: Repository<User> = app.get(getRepositoryToken(User));
  const earned: Repository<UserTrophy> = app.get(
    getRepositoryToken(UserTrophy),
  );

  const all = await users.find({
    select: { id: true, username: true, xp: true },
  });
  console.log(
    `${dryRun ? '[DRY RUN] ' : ''}${all.length} хэрэглэгч шалгаж байна\n`,
  );

  let total = 0;
  for (const u of all) {
    const before = await earned.count({ where: { userId: u.id } });

    // Same evaluation either way; the dry run simply stops before inserting.
    const won = dryRun
      ? await achievements.evaluateFor(u.id, ALL_TYPES)
      : await achievements.award(u.id, ALL_TYPES, true);

    total += won.length;
    const label = `${u.username ?? u.id.slice(0, 8)} (XP ${u.xp})`;
    console.log(
      `  ${label.padEnd(28)} өмнө ${String(before).padStart(3)} · шинэ ${String(won.length).padStart(3)}` +
        (won.length
          ? `  ${won.slice(0, 4).join(', ')}${won.length > 4 ? '…' : ''}`
          : ''),
    );
  }

  console.log(`\nНийт ${dryRun ? 'олгогдох байсан' : 'олгосон'}: ${total}`);
  if (dryRun) console.log('[DRY RUN] DB өөрчлөгдөөгүй.');
  await app.close();
}

main()
  .then(() => {
    // AppModule registers cron timers and a Redis client that keep the event
    // loop alive past app.close(); a one-shot script has to exit explicitly.
    process.exit(0);
  })
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
