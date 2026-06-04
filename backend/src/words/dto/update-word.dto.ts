import { PartialType } from '@nestjs/mapped-types';
import { CreateWordDto } from './create-word.dto';

/**
 * Body for PATCH /api/words/:id. PartialType makes every field from
 * CreateWordDto optional, so admins can update just the fields they change.
 */
export class UpdateWordDto extends PartialType(CreateWordDto) {}
