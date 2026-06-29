import { PartialType } from '@nestjs/mapped-types';
import { CreateIdiomDto } from './create-idiom.dto';

/** Body for PATCH /api/idioms/:id — every field optional (incl. isPublished). */
export class UpdateIdiomDto extends PartialType(CreateIdiomDto) {}
