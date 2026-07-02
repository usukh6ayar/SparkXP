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

  // --- Voice + avatar config (null = fall back to env defaults / 2D image) ---

  /** Per-buddy ElevenLabs voice id; null uses ELEVENLABS_VOICE_ID. */
  @Column({ name: 'voice_id', type: 'varchar', nullable: true })
  voiceId: string | null;

  /** ElevenLabs voice params (speed/stability/style). */
  @Column({ name: 'tts_params', type: 'jsonb', nullable: true })
  ttsParams: Record<string, unknown> | null;

  /** emotion/gesture tag → avatar animation clip name (used by mobile). */
  @Column({ name: 'emotion_map', type: 'jsonb', nullable: true })
  emotionMap: Record<string, string> | null;

  /** GLB 3D avatar asset URL (Cloudinary/CDN); null = use 2D image. */
  @Column({ name: 'avatar_asset_url', type: 'varchar', nullable: true })
  avatarAssetUrl: string | null;

  /** Thumbnail shown in the buddy picker. */
  @Column({ name: 'avatar_thumb_url', type: 'varchar', nullable: true })
  avatarThumbUrl: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
