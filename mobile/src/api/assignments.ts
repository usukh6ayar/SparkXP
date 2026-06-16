import { apiRequest } from './client';

export type AssignmentType = 'lesson' | 'quiz';

/** An assignment row. `targetId` points at a lesson or quiz (resolve title client-side). */
export interface Assignment {
  id: string;
  classId: string;
  type: AssignmentType;
  targetId: string;
  assignedById: string;
  dueAt: string | null;
  createdAt: string;
}

export interface CreateAssignmentInput {
  classId: string;
  type: AssignmentType;
  targetId: string;
  dueAt?: string; // ISO date
}

/** POST /assignments — teacher assigns a lesson/quiz to a class. */
export function createAssignment(
  input: CreateAssignmentInput,
  token: string,
): Promise<Assignment> {
  return apiRequest<Assignment>('/assignments', {
    method: 'POST',
    body: input,
    token,
  });
}

/** GET /assignments?classId= — assignments of a class. */
export function getClassAssignments(classId: string, token: string): Promise<Assignment[]> {
  return apiRequest<Assignment[]>(`/assignments?classId=${classId}`, { token });
}

/** GET /assignments/mine — assignments across the student's enrolled classes. */
export function getMyAssignments(token: string): Promise<Assignment[]> {
  return apiRequest<Assignment[]>('/assignments/mine', { token });
}

/** DELETE /assignments/:id — teacher removes an assignment. */
export function deleteAssignment(id: string, token: string): Promise<void> {
  return apiRequest<void>(`/assignments/${id}`, { method: 'DELETE', token });
}
