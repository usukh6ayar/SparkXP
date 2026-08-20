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
  /**
   * Сорилын аль асуултууд оногдсон бэ. `null` = бүгд.
   * Багш нэг тестээс 5 асуулт сонгож өгөх зам.
   */
  questionIndexes?: number[] | null;
  /**
   * Хичээл/сорилын гарчиг — **серверээс** ирнэ.
   *
   * Даалгаврын сангийн тест сурагчийн `GET /quizzes` жагсаалтад огт
   * харагдахгүй тул апп гарчгийг өөрөө олж чадахгүй.
   */
  targetTitle?: string | null;
  /** Сорилын сэдэв — нэг дор ирсэн 2 сэдвийн даалгаврыг ялгахад. */
  targetTopic?: string | null;
  /** Сурагчийн үнэхээр хийх асуултын тоо (хичээлд `null`). */
  questionCount?: number | null;
}

/** Нэг илгээлтийн доторх нэг сэдвийн даалгавар. */
export interface AssignmentTarget {
  targetId: string;
  /** Тухайн тестээс сонгосон асуултууд. Хоосон = бүгд. */
  questionIndexes?: number[];
}

export interface CreateAssignmentInput {
  classId: string;
  type: AssignmentType;
  /** Ганц зүйл оноох богино хэлбэр. `targets`-тэй хамт илгээж болохгүй. */
  targetId?: string;
  /**
   * Нэг дор оноох олон зүйл — сэдэв тус бүрд нэг мөр. Багш Present Simple ба
   * Modal verbs хоёрыг нэг илгээлтээр өгөхөд ингэж явна (мэдэгдэл нэг очно).
   */
  targets?: AssignmentTarget[];
  dueAt?: string; // ISO date
  note?: string;
  studentIds?: string[]; // omit = whole class
}

/**
 * POST /assignments — багш ангид хичээл/сорил оноох.
 *
 * Нэг илгээлт олон даалгавар үүсгэж болох тул **массив** буцаана.
 */
export function createAssignment(
  input: CreateAssignmentInput,
  token: string,
): Promise<Assignment[]> {
  return apiRequest<Assignment[]>('/assignments', {
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
