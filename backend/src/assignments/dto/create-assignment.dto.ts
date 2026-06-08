import {
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { AssignmentType } from '../../common/enums';

export class CreateAssignmentDto {
  @IsUUID()
  classId: string;

  @IsEnum(AssignmentType)
  type: AssignmentType;

  /** ID of the Lesson or Quiz being assigned. */
  @IsUUID()
  targetId: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;
}
