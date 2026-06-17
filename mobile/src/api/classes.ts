import { apiRequest } from './client';

/** A user as embedded in a class roster (no password hash). */
export interface ClassStudent {
  id: string;
  fullName: string;
  email: string;
  username?: string | null;
  role: string;
  xp: number;
  sparks: number;
  avatarUrl?: string | null;
  province?: string | null;
  district?: string | null;
}

/** A class row (as returned by GET /classes teaching/enrolled lists). */
export interface ClassSummary {
  id: string;
  name: string;
  joinCode: string;
  organizationId: string | null;
  teacherId: string | null;
  createdAt: string;
}

/** A class with its teacher + student roster (GET /classes/:id). */
export interface ClassDetail extends ClassSummary {
  teacher: ClassStudent | null;
  students: ClassStudent[];
  updatedAt: string;
}

/** The classes relevant to the current user. */
export interface MyClasses {
  teaching: ClassSummary[];
  enrolled: ClassSummary[];
}

/** GET /classes — classes the user teaches + the ones they're enrolled in. */
export function getMyClasses(token: string): Promise<MyClasses> {
  return apiRequest<MyClasses>('/classes', { token });
}

/** POST /classes — teacher creates a class (join code auto-generated). */
export function createClass(
  name: string,
  organizationId: string,
  token: string,
): Promise<ClassSummary> {
  return apiRequest<ClassSummary>('/classes', {
    method: 'POST',
    body: { name, organizationId },
    token,
  });
}

/** GET /classes/:id — one class with its roster. */
export function getClass(id: string, token: string): Promise<ClassDetail> {
  return apiRequest<ClassDetail>(`/classes/${id}`, { token });
}

/** GET /classes/:id/students — the roster (teacher/admin only). */
export function getClassStudents(id: string, token: string): Promise<ClassStudent[]> {
  return apiRequest<ClassStudent[]>(`/classes/${id}/students`, { token });
}

/** POST /classes/join — student requests to join (needs teacher approval). */
export function requestJoinClass(
  joinCode: string,
  token: string,
): Promise<{ status: 'pending'; className: string }> {
  return apiRequest('/classes/join', { method: 'POST', body: { joinCode }, token });
}

/** GET /classes/:id/requests — pending join requests (teacher/admin only). */
export function getJoinRequests(id: string, token: string): Promise<ClassStudent[]> {
  return apiRequest<ClassStudent[]>(`/classes/${id}/requests`, { token });
}

/** POST /classes/:id/requests/:studentId/approve — enroll a pending student. */
export function approveRequest(
  classId: string,
  studentId: string,
  token: string,
): Promise<ClassDetail> {
  return apiRequest<ClassDetail>(
    `/classes/${classId}/requests/${studentId}/approve`,
    { method: 'POST', token },
  );
}

/** DELETE /classes/:id/requests/:studentId — reject a pending request. */
export function rejectRequest(
  classId: string,
  studentId: string,
  token: string,
): Promise<void> {
  return apiRequest<void>(`/classes/${classId}/requests/${studentId}`, {
    method: 'DELETE',
    token,
  });
}
