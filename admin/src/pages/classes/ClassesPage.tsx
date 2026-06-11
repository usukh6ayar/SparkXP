import { useState, useEffect, useCallback } from 'react';
import { Users, Copy, Check } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';

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

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<ClassRow | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<ClassRow[]>('/classes/all');
    setClasses(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function openClass(c: ClassRow) {
    setDetail(c);
    setLoadingStudents(true);
    try {
      const data = await api.get<Student[]>(`/classes/${c.id}/students`);
      setStudents(Array.isArray(data) ? data : []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(''), 2000);
  }

  const filtered = classes.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.teacherName ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Ангиуд"
        description={`Нийт: ${classes.length} анги`}
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
              {/* Class name */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{c.name}</h3>
                <Badge color="blue">{c.studentCount} сурагч</Badge>
              </div>

              {/* Teacher */}
              <p className="text-sm text-gray-500 mb-3">
                👨‍🏫 {c.teacherName ?? <span className="italic text-gray-300">Багш байхгүй</span>}
              </p>

              {/* Join code */}
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

      {/* Class detail modal */}
      {detail && (
        <Modal
          title={`${detail.name} — Сурагчдын жагсаалт`}
          onClose={() => { setDetail(null); setStudents([]); }}
        >
          {loadingStudents ? (
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
          )}
        </Modal>
      )}
    </>
  );
}
