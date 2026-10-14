import { IsIn } from 'class-validator';
import {
  REPORT_REASONS,
  type ReportReason,
} from '../../entities/user-report.entity';

export const RESOLVE_ACTIONS = [
  'dismiss',
  'remove_avatar',
  'reset_name',
] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

/** POST /users/:id/report */
export class ReportUserDto {
  @IsIn([...REPORT_REASONS])
  reason: ReportReason;
}

/** POST /admin/reports/:id/resolve */
export class ResolveReportDto {
  @IsIn([...RESOLVE_ACTIONS])
  action: ResolveAction;
}
