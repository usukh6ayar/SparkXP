import { PartialType } from '@nestjs/mapped-types';
import { CreateLessonDto } from './create-lesson.dto';

/** Body for PATCH /api/lessons/:id — every field optional. */
export class UpdateLessonDto extends PartialType(CreateLessonDto) {}
