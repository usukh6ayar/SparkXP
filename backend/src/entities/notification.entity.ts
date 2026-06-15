import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('notifications')
export class Notification extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'target_role', type: 'varchar', nullable: true })
  targetRole: string | null;

  @Column({ name: 'sent_count', type: 'int', default: 0 })
  sentCount: number;
}
