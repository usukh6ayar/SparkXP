import { IsUUID, IsEnum, IsOptional, IsDateString } from 'class-validator';
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
}
