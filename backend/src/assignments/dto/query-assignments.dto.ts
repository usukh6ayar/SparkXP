import { IsUUID, IsOptional } from 'class-validator';

export class QueryAssignmentsDto {
  /** Filter by class (required for teacher view). */
  @IsOptional()
  @IsUUID()
  classId?: string;
}
