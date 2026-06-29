import { PartialType } from '@nestjs/mapped-types';
import { CreateReadingDto } from './create-reading.dto';

/** Body for PATCH /api/reading/:id — every field optional (incl. isPublished). */
export class UpdateReadingDto extends PartialType(CreateReadingDto) {}
