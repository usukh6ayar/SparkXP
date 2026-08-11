import { IsString, MaxLength } from 'class-validator';

/** Body for PATCH /api/lessons/:id/transcript — админы гараар засварласан бичвэр. */
export class UpdateTranscriptDto {
  /** Хоосон мөр зөвшөөрнө — админ буруу хөрвүүлэлтийг цэвэрлэж болно. */
  @IsString()
  @MaxLength(200_000)
  text: string;
}
