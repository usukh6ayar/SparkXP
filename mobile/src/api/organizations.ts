import { apiRequest } from './client';

/** A school / company / org (super-admin managed). */
export interface Organization {
  id: string;
  name: string;
  type: string;
  province?: string | null;
  district?: string | null;
}

/** GET /organizations — the schools a teacher can attach a class to. */
export function getOrganizations(token: string): Promise<Organization[]> {
  return apiRequest<{ items: Organization[]; total: number }>(
    '/organizations?limit=200',
    { token },
  ).then((r) => r.items);
}
