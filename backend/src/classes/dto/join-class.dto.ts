import { IsString, Length } from 'class-validator';

/** Body for POST /api/classes/join — a student enrolls with a class's code. */
export class JoinClassDto {
  /** The class join code (case-insensitive; we normalize to upper case). */
  @IsString()
  @Length(4, 12)
  joinCode: string;
}
