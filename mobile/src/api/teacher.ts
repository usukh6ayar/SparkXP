import { apiRequest } from './client';

export type SubmissionStatus = 'assigned' | 'completed' | 'late';

export interface TeacherDashboard {
  classCount: number;
  studentCount: number;
  activeStudents: number;
  pending: number;
  overdue: number;
  classes: { id: string; name: string }[];
}

/** null = no data for that skill (render as "—", not 0%). */
export interface SkillBreakdown {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  fill: number | null;
}

export interface ClassOverview {
  studentCount: number;
  skills: SkillBreakdown;
  weakestSkill: string | null;
  students: { studentId: string; fullName: string; completionPct: number | null }[];
}

export interface StudentProgress {
  studentId: string;
  fullName: string;
  avatarUrl: string | null;
  xp: number;
  currentStreak: number;
  skills: SkillBreakdown & { vocab: number | null };
  assignments: {
    assignmentId: string;
    type: 'lesson' | 'quiz' | null;
    status: SubmissionStatus;
    scorePct: number | null;
    submittedAt: string | null;
  }[];
}

export interface Submission {
  studentId: string;
  fullName: string | null;
  status: SubmissionStatus;
  scorePct: number | null;
  submittedAt: string | null;
  attemptCount: number;
}

/** GET /teacher/dashboard — totals across the teacher's classes. */
export function getTeacherDashboard(token: string): Promise<TeacherDashboard> {
  return apiRequest<TeacherDashboard>('/teacher/dashboard', { token });
}

/** GET /classes/:id/overview — class skill breakdown + per-student completion. */
export function getClassOverview(classId: string, token: string): Promise<ClassOverview> {
  return apiRequest<ClassOverview>(`/classes/${classId}/overview`, { token });
}

/** GET /classes/:id/students/:studentId/progress — one student's breakdown + history. */
export function getStudentProgress(
  classId: string,
  studentId: string,
  token: string,
): Promise<StudentProgress> {
  return apiRequest<StudentProgress>(
    `/classes/${classId}/students/${studentId}/progress`,
    { token },
  );
}

/** GET /assignments/:id/submissions — teacher view of who's done/pending/late. */
export function getAssignmentSubmissions(
  assignmentId: string,
  token: string,
): Promise<Submission[]> {
  return apiRequest<Submission[]>(`/assignments/${assignmentId}/submissions`, { token });
}
