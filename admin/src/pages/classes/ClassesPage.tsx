import { useState, useEffect, useCallback } from 'react';
import { Users, Copy, Check, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';

interface ClassRow {
  id: string;
  name: string;
  joinCode: string;
  teacherId: string | null;
  teacherName: string | null;
  studentCount: number;
  createdAt: string;
}

interface Student {
  id: string;
  fullName: string;
  email: string;
  username: string | null;
  phone: string | null;
  xp: number;
  trophies: string[] | null;
}

interface Assignment {
  id: string;
  type: 'lesson' | 'quiz';
  targetId: string;
  dueAt: string | null;
  createdAt: string;
  completedCount: number;
}

interface LessonOption { id: string; title: string; }
interface QuizOption  { id: string; title: string; }

type DetailTab = 'students' | 'assignments';

interface AssignForm {
  type: 'lesson' | 'quiz';
  targetId: string;
  dueAt: string;
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState('');
  const [createModal, setCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [detail, setDetail] = useState<ClassRow | null>(null);
  const [tab, setTab] = useState<DetailTab>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [copied, setCopied] = useState('');
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignForm, setAssignForm] = useState<AssignForm>({ type: 'lesson', targetId: '', dueAt: '' });
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignError, setAssignError] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<ClassRow[]>('/classes/all');
    setClasses(Array.isArray(data) ? data : []);
  }, []);

  async function createClass() {
    if (!newClassName.trim()) { setCreateError('Ангийн нэр оруулна уу'); return; }
    setCreating(true); setCreateError('');
    try {
      await api.post('/classes', { name: newClassName.trim() });
      setCreateModal(false);
      setNewClassName('');
      load();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setCreating(false); }
  }

  useEffect(() => { load(); }, [load]);

  // Load lessons + quizzes once for the assignment dropdown
  useEffect(() => {
    api.get<{ items: LessonOption[] }>('/lessons?limit=200')
      .then(d => setLessons(d.items ?? []))
      .catch(() => {});
    api.get<{ items: QuizOption[] }>('/quizzes?limit=200')
      .then(d => setQuizzes(d.items ?? []))
      .catch(() => {});
  }, []);

  async function openClass(c: ClassRow) {
    setDetail(c);
    setTab('students');
    setStudents([]);
    setAssignments([]);
    setShowAssignForm(false);
    setAssignError('');
    fetchStudents(c.id);
  }

  async function fetchStudents(classId: string) {
    setLoadingStudents(true);
    try {
      const data = await api.get<Student[]>(`/classes/${classId}/students`);
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  async function fetchAssignments(classId: string) {
    setLoadingAssignments(true);
    try {
      const data = await api.get<Assignment[]>(`/assignments?classId=${classId}`);
      setAssignments(Array.isArray(data) ? data : []);
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  }

  function switchTab(t: DetailTab) {
    setTab(t);
    if (!detail) return;
    if (t === 'assignments' && assignments.length === 0) fetchAssignments(detail.id);
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  }

  async function createAssignment() {
    if (!assignForm.targetId) { setAssignError('Хичээл эсвэл сорил сонгоно уу'); return; }
    if (!detail) return;
    setAssignSaving(true); setAssignError('');
    try {
      await api.post('/assignments', {
        classId: detail.id,
        type: assignForm.type,
        targetId: assignForm.targetId,
        dueAt: assignForm.dueAt || undefined,
      });
      setShowAssignForm(false);
      setAssignForm({ type: 'lesson', targetId: '', dueAt: '' });
      fetchAssignments(detail.id);
    } catch (e: unknown) {
      setAssignError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally {
      setAssignSaving(false);
    }
  }

  async function deleteAssignment(id: string) {
    if (!confirm('Энэ даалгаврыг устгах уу?')) return;
    try {
      await api.delete(`/assignments/${id}`);
      setAssignments(prev => prev.filter(a => a.id !== id));
    } catch {
      alert('Устгахад алдаа гарлаа');
    }
  }

  const filtered = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.teacherName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const targetOptions = (assignForm.type === 'lesson' ? lessons : quizzes).map(o => (
    <option key={o.id} value={o.id}>{o.title}</option>
  ));

  return (
    <>
      <PageHeader
        title="Ангиуд"
        description={`Нийт: ${classes.length} анги`}
        action={
          <Button onClick={() => { setNewClassName(''); setCreateError(''); setCreateModal(true); }}>
            <Plus className="h-4 w-4" /> Анги нэмэх
          </Button>
        }
      />

      <div className="mb-4">
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-72 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Ангийн нэр эсвэл багшаар хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Анги байхгүй — багш нар app дотроосоо анги үүсгэсний дараа энд харагдана
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openClass(c)}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{c.name}</h3>
                <Badge color="blue">{c.studentCount} сурагч</Badge>
              </div>

              <p className="text-sm text-gray-500 mb-3">
                👨‍🏫 {c.teacherName ?? <span className="italic text-gray-300">Багш байхгүй</span>}
              </p>

              <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Нэгдэх код</p>
                  <p className="font-mono font-bold text-primary tracking-widest">{c.joinCode}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); copyCode(c.joinCode); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                  title="Код хуулах"
                >
                  {copied === c.joinCode
                    ? <Check className="h-4 w-4 text-green-500" />
                    : <Copy className="h-4 w-4" />}
                </button>
              </div>

              <p className="text-xs text-gray-300 mt-2">
                {new Date(c.createdAt).toLocaleDateString('mn-MN')}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create class modal */}
      {createModal && (
        <Modal title="Анги нэмэх" onClose={() => setCreateModal(false)}>
          <div className="space-y-4">
            <Input
              label="Ангийн нэр"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              placeholder="жишээ: 10A анги, Мандах сургууль..."
            />
            <p className="text-xs text-gray-400">
              Нэгдэх кодыг систем автоматаар үүсгэнэ. Эзэн багш нь admin хэрэглэгч болно.
            </p>
            {createError && <p className="text-sm text-red-500">{createError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCreateModal(false)}>Болих</Button>
              <Button onClick={createClass} disabled={creating}>
                {creating ? 'Үүсгэж байна...' : 'Үүсгэх'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Class detail modal */}
      {detail && (
        <Modal
          title={detail.name}
          onClose={() => { setDetail(null); setStudents([]); setAssignments([]); }}
        >
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4 -mt-1">
            <button
              onClick={() => switchTab('students')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'students'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Users className="h-4 w-4 inline mr-1.5 -mt-0.5" />
              Сурагчид ({students.length})
            </button>
            <button
              onClick={() => switchTab('assignments')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'assignments'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              📋 Даалгаварууд ({assignments.length})
            </button>
          </div>

          {/* Students tab */}
          {tab === 'students' && (
            loadingStudents ? (
              <p className="text-sm text-gray-400 py-6 text-center">Уншиж байна...</p>
            ) : students.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                Сурагч байхгүй — <span className="font-mono font-bold text-primary">{detail.joinCode}</span> кодоор нэгдэнэ
              </p>
            ) : (
              <div className="space-y-2">
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2.5">
                    <span className="w-6 text-xs text-gray-400 font-medium">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.fullName}</p>
                      <div className="flex gap-2 text-xs text-gray-400 flex-wrap">
                        {s.username && <span>@{s.username}</span>}
                        {s.phone && <span>📞 {s.phone}</span>}
                        <span>{s.email}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs shrink-0">
                      <span className="text-primary font-medium">⚡ {s.xp}</span>
                      {(s.trophies ?? []).length > 0 && (
                        <span className="text-amber-500">🏆 {s.trophies!.length}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Нэгдэх код: <span className="font-mono font-bold text-primary">{detail.joinCode}</span>
                    {' '}— Энэ кодыг сурагчдад илгээнэ
                  </p>
                </div>
              </div>
            )
          )}

          {/* Assignments tab */}
          {tab === 'assignments' && (
            <div className="space-y-3">
              {/* Create assignment form */}
              {showAssignForm ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Шинэ даалгавар нэмэх</p>

                  {/* Type toggle */}
                  <div className="flex gap-2">
                    {(['lesson', 'quiz'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAssignForm(f => ({ ...f, type: t, targetId: '' }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          assignForm.type === t
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                        }`}
                      >
                        {t === 'lesson' ? '📚 Хичээл' : '❓ Сорил'}
                      </button>
                    ))}
                  </div>

                  {/* Target selector */}
                  <select
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    value={assignForm.targetId}
                    onChange={(e) => setAssignForm(f => ({ ...f, targetId: e.target.value }))}
                  >
                    <option value="">{assignForm.type === 'lesson' ? 'Хичээл сонгох...' : 'Сорил сонгох...'}</option>
                    {targetOptions}
                  </select>

                  {/* Due date */}
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Дуусах огноо (заавал биш)</label>
                    <input
                      type="datetime-local"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none w-full"
                      value={assignForm.dueAt}
                      onChange={(e) => setAssignForm(f => ({ ...f, dueAt: e.target.value }))}
                    />
                  </div>

                  {assignError && <p className="text-sm text-red-500">{assignError}</p>}

                  <div className="flex gap-2">
                    <Button size="sm" onClick={createAssignment} disabled={assignSaving}>
                      {assignSaving ? 'Хадгалж байна...' : 'Оноох'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setShowAssignForm(false); setAssignError(''); }}>
                      Болих
                    </Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" onClick={() => setShowAssignForm(true)}>
                  <Plus className="h-4 w-4" /> Даалгавар нэмэх
                </Button>
              )}

              {/* Assignment list */}
              {loadingAssignments ? (
                <p className="text-sm text-gray-400 py-4 text-center">Уншиж байна...</p>
              ) : assignments.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">Даалгавар байхгүй байна</p>
              ) : (
                <div className="space-y-2">
                  {assignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2.5">
                      <span className="text-base">{a.type === 'lesson' ? '📚' : '❓'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{a.type === 'lesson' ? 'Хичээл' : 'Сорил'}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{a.targetId}</p>
                        {a.dueAt && (
                          <p className="text-xs text-amber-600">⏰ {new Date(a.dueAt).toLocaleString('mn-MN')}</p>
                        )}
                      </div>
                      {/* Completion count badge */}
                      <div className="shrink-0 text-center px-2">
                        <span className={`text-sm font-bold ${a.completedCount > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                          {a.completedCount}
                        </span>
                        <p className="text-xs text-gray-400">/{students.length}</p>
                      </div>
                      <button
                        onClick={() => deleteAssignment(a.id)}
                        className="text-red-400 hover:text-red-600 p-1 transition-colors"
                        title="Устгах"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
