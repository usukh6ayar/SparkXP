import {
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Base class every entity extends.
 *
 * Enforces two project rules from CLAUDE.md:
 *  - UUID primary keys (never auto-increment ints).
 *  - created_at / updated_at timestamps on every table.
 *
 * Extend this instead of repeating these three columns everywhere.
 */
export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
