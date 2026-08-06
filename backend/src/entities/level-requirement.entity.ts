import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * How many total stars a CEFR level (island/castle) needs before it unlocks.
 *
 * Stored in the DB — not hardcoded — so the economy is tunable from admin
 * without an app update (Core Rule). One row per CEFR level (`a1`…`c2`); a level
 * with no row falls back to the service default. `a1` is always 0 (the start).
 */
@Entity('level_requirements')
@Unique('uq_level_requirement_code', ['levelCode'])
export class LevelRequirement extends BaseEntity {
  /** CEFR code: a1 · a2 · b1 · b2 · c1 · c2. */
  @Column({ name: 'level_code', type: 'varchar', length: 8 })
  levelCode: string;

  /** Total stars (across all lessons) required to unlock this level. */
  @Column({ name: 'stars_required', type: 'int', default: 0 })
  starsRequired: number;
}
