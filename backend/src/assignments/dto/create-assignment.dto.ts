import { IsUUID, IsEnum, IsOptional, IsDateString, IsString, IsArray, MaxLength } from 'class-validator';
import { AssignmentType } from '../../common/enums';

/**
 * Body for POST /api/assignments. A teacher points a class at a lesson or quiz,
 * optionally with a due date.
 */
export class CreateAssignmentDto {
  @IsUUID()
  classId: string;

  @IsEnum(AssignmentType)
  type: AssignmentType;

  /** ID of the Lesson or Quiz this assignment targets (matching `type`). */
  @IsUUID()
  targetId: string;

  /** Optional ISO-8601 due date. */
  @IsOptional()
  @IsDateString()
  dueAt?: string;

  /** Optional teacher note. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  /** Target specific students (must be in the class). Omit = whole class. */
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  studentIds?: string[];
}
