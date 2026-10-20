import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';

/**
 * Admin plan edit. Every field optional; `null` on a limit = unlimited.
 * The slug is fixed — the `free` row and the website's cards are keyed by it.
 */
export class UpdatePlanDto extends PartialType(
  OmitType(CreatePlanDto, ['slug'] as const),
) {}
