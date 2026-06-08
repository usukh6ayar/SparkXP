import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  /** Link to an org if this is a school class. Optional for independent teachers. */
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
