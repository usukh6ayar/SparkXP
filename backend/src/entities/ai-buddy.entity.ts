import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity('ai_buddies')
export class AiBuddy extends BaseEntity {
  @Column({ unique: true })
  slug: string;

  @Column()
  name: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column()
  emoji: string;

  @Column({ type: 'text', name: 'system_prompt' })
  systemPrompt: string;

  @Column({ name: 'extra_messages_amount', type: 'int', default: 50 })
  extraMessagesAmount: number;

  @Column({ name: 'extra_messages_cost', type: 'int', default: 5000 })
  extraMessagesCost: number;

  @Column({ name: 'voice_minute_cost', type: 'int', nullable: true })
  voiceMinuteCost: number | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
