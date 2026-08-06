import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { EventType } from '../common/enums';

/**
 * A time-boxed Home "event" (Daily / Weekly challenge / Double XP).
 *
 * Admin-authored and DB-driven (Core Rule) — the app never hardcodes events; it
 * asks `GET /events/active` for whatever is live right now. A `double_xp` event
 * additionally multiplies every XP award while its window is open (see
 * `XpService.award`). The active window is `[startsAt, endsAt]` intersected with
 * `isActive`, so an event can be pre-scheduled and toggled off without deleting.
 */
@Entity('events')
@Index('idx_event_window', ['startsAt', 'endsAt'])
export class Event extends BaseEntity {
  @Column({ type: 'enum', enum: EventType })
  type: EventType;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 400, nullable: true })
  description: string | null;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  /** Bonus XP a Daily/Weekly event advertises (display only). */
  @Column({ name: 'reward_xp', type: 'int', nullable: true })
  rewardXp: number | null;

  /** XP multiplier for `double_xp` events (e.g. 2). Null for other types. */
  @Column({ name: 'xp_multiplier', type: 'numeric', precision: 4, scale: 2, nullable: true })
  xpMultiplier: string | null;

  /** Admin off-switch — an event outside its window OR not active never shows. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
