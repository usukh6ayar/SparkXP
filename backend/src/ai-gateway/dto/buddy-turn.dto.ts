import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BuddySessionMode } from '../../common/enums';

/** Start an AI Buddy conversation session. */
export class StartSessionDto {
  @IsString()
  buddySlug: string;

  @IsOptional()
  @IsIn([BuddySessionMode.VOICE, BuddySessionMode.TEXT])
  mode?: BuddySessionMode;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  topic?: string;
}

/**
 * Open a typed-chat thread: a specific `sessionId`, a brand-new thread
 * (`new: true`), or (default) the most recent one for this buddy.
 */
export class ResumeTextSessionDto {
  @IsString()
  buddySlug: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsBoolean()
  new?: boolean;
}

/** A typed (text) turn — STT is skipped. */
export class TextTurnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  text: string;

  /** t0 — see {@link ClientLatencyDto}. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  t0?: number;

  /**
   * Клиентийн үүсгэсэн turn id. Өгвөл сервер аудиог хэсэглэн, бэлэн болмогц нь
   * нийтэлнэ — клиент энэ хүсэлт нисэж байх зуур хэсгүүдийг зэрэгцээд татаж
   * эрт ярьж эхэлнэ. Орхивол хуучин "бүгдийг хүлээх" зам.
   */
  @IsOptional()
  @IsUUID()
  streamId?: string;
}

/**
 * Клиентийн эзэмшдэг латенсийн цэгүүд (латенсийн төлөвлөгөө §1).
 *
 * Сервер эдгээрийг хэмжиж чадахгүй: t0 нь хэрэглэгч ярихаа больсон агшин
 * (микрофоны endpoint), t7 нь чанга яригчаас дуу гарсан агшин. Хэрэглэгчийн
 * бодит хүлээлт (t7 − t0) нь ЗӨВХӨН энэ хоёроор гарна — сервер талын нийт
 * хугацаа нь аудио байршуулах, татах, декодлох хугацааг агуулдаггүй.
 *
 * Утасны цаг найдваргүй тул сервер тал нь `t0`-г зөвхөн ӨӨРИЙН хүлээж авсан
 * агшинтай харьцуулж `upload_ms` гаргана; сөрөг гарвал хаяна.
 */
export class ClientLatencyDto {
  /** Аль turn-ийнх вэ (`TurnResponse.turn_id`). */
  @IsString()
  @MaxLength(64)
  turnId: string;

  /** t7 — аудио бодитоор сонсогдож эхэлсэн, t0-оос хойшхи ms. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  t0ToAudibleMs?: number;

  /** t8 — эхний viseme хэрэглэгдсэн, t0-оос хойшхи ms. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  t0ToFirstVisemeMs?: number;

  /** t9 — тоглуулалт дуусав, t0-оос хойшхи ms. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  t0ToReplyDoneMs?: number;
}

/** Admin: preview a buddy's TTS voice with a sample line. */
export class TestVoiceDto {
  @IsString()
  buddySlug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(300)
  text: string;
}

/**
 * User feedback on one AI Buddy reply.
 *
 * `up`/`down` are quality signals. **`report` is different**: it is the
 * "this reply was offensive/harmful" channel that Google Play's Generative AI
 * policy requires an app to offer for AI-generated content, so it additionally
 * raises a `safety_events` row for the admin audit log. Keeping it in the same
 * endpoint (rather than a second one) means the client sends the same payload
 * either way and the message is looked up + ownership-checked once.
 */
export class FeedbackDto {
  @IsUUID()
  messageId: string;

  @IsIn(['up', 'down', 'report'])
  rating: 'up' | 'down' | 'report';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
