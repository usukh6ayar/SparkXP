import { apiRequest } from './client';
import type { SubmissionStatus } from './teacher';

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
  /** Optional note the teacher wrote with the task. */
  note?: string | null;
  /** Present on GET /assignments/mine rows (the student's own submission state). */
  status?: SubmissionStatus;
  scorePct?: number | null;
  /**
   * Present on GET /assignments?classId= (the teacher's view): how many of the
   * targeted students have actually handed it in. Counts submitted rows only —
   * the still-pending `assigned` ones are excluded server-side.
   */
  completedCount?: number;
  /** Who it was set for. `null` = the whole class. */
  studentIds?: string[] | null;
}

export interface CreateAssignmentInput {
  classId: string;
  type: AssignmentType;
  targetId: string;
  dueAt?: string; // ISO date
  note?: string;
  studentIds?: string[]; // omit = whole class
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
