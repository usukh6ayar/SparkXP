import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

/** Body for PATCH /api/organizations/:id — every field optional. */
export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
