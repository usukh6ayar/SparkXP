import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Table } from '../../components/Table';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../lib/utils';

interface UserUsage {
  id: string;
  fullName: string;
  email: string;
  role: string;
  xp: number;
  voiceSecondsUsed: number;
  sttSecondsUsed: number;
  dictionaryAiCount: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  memoryStorageMb: number;
  usageResetAt: string | null;
}

function fmtMins(seconds: number): string {
  if (seconds === 0) return '0';
  const m = seconds / 60;
  return m < 1 ? `${seconds}s` : `${m.toFixed(1)}`;
}

function fmtTokens(n: number): string {
  if (n === 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const roleColors: Record<string, 'blue' | 'green' | 'yellow' | 'gray'> = {
  student: 'gray',
  teacher: 'blue',
  moderator: 'yellow',
  admin: 'green',
  super_admin: 'red' as never,
};

export default function UsagePage() {
  const [users, setUsers] = useState<UserUsage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 50;

  const load = useCallback(async () => {
    const data = await api.get<{ items: UserUsage[]; total: number }>(
      `/users?page=${page}&limit=${limit}`,
    );
    setUsers(data.items ?? []);
    setTotal(data.total ?? 0);
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalVoiceMins = users.reduce((s, u) => s + u.voiceSecondsUsed / 60, 0);
  const totalDictCount = users.reduce((s, u) => s + u.dictionaryAiCount, 0);
  const totalTokens = users.reduce((s, u) => s + u.aiInputTokens + u.aiOutputTokens, 0);
  const activeUsers = users.filter(
    (u) => u.voiceSecondsUsed > 0 || u.dictionaryAiCount > 0 || u.aiInputTokens > 0,
  ).length;

  const columns = [
    {
      key: 'user', header: 'Хэрэглэгч',
      render: (u: UserUsage) => (
        <div>
          <p className="font-medium text-sm">{u.fullName}</p>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
      ),
    },
    {
      key: 'role', header: 'Роль',
      render: (u: UserUsage) => (
        <Badge color={roleColors[u.role] ?? 'gray'}>{u.role}</Badge>
      ),
    },
    {
      key: 'voice', header: '🎙 Voice мин',
      render: (u: UserUsage) => (
        <span className={u.voiceSecondsUsed > 0 ? 'font-medium text-primary' : 'text-gray-300'}>
          {fmtMins(u.voiceSecondsUsed)}
        </span>
      ),
    },
    {
      key: 'stt', header: '🎧 STT мин',
      render: (u: UserUsage) => (
        <span className={u.sttSecondsUsed > 0 ? 'font-medium text-primary' : 'text-gray-300'}>
          {fmtMins(u.sttSecondsUsed)}
        </span>
      ),
    },
    {
      key: 'dict', header: '📖 Толь',
      render: (u: UserUsage) => (
        <span className={u.dictionaryAiCount > 0 ? 'font-medium text-primary' : 'text-gray-300'}>
          {u.dictionaryAiCount}
        </span>
      ),
    },
    {
      key: 'tokens', header: '🤖 Токен',
      render: (u: UserUsage) => {
        const t = u.aiInputTokens + u.aiOutputTokens;
        return (
          <span className={t > 0 ? 'font-medium text-primary' : 'text-gray-300'}>
            {fmtTokens(t)}
          </span>
        );
      },
    },
    {
      key: 'memory', header: '🧠 Memory',
      render: (u: UserUsage) => (
        <span className={u.memoryStorageMb > 0 ? 'font-medium text-primary' : 'text-gray-300'}>
          {u.memoryStorageMb > 0 ? `${u.memoryStorageMb.toFixed(1)} MB` : '0'}
        </span>
      ),
    },
    {
      key: 'reset', header: 'Reset огноо',
      render: (u: UserUsage) => u.usageResetAt
        ? <span className="text-xs text-gray-400">{formatDate(u.usageResetAt)}</span>
        : <span className="text-gray-300">—</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Хэрэглэгчийн хэрэглээ"
        description="Хэрэглэгч бүрийн сарын AI хэрэглээний статистик"
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <StatCard label="Нийт хэрэглэгч" value={total} unit="хэрэглэгч" />
        <StatCard label="AI хэрэглэсэн" value={activeUsers} unit="хэрэглэгч" />
        <StatCard label="Нийт Voice" value={totalVoiceMins.toFixed(1)} unit="мин" />
        <StatCard label="Нийт токен" value={fmtTokens(totalTokens)} unit="токен" />
      </div>

      {totalDictCount > 0 && (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          📖 Энэ хуудсанд байгаа хэрэглэгчид нийт <strong>{totalDictCount}</strong> удаа AI толь бичиг хэрэглэсэн
        </div>
      )}

      <Table columns={columns} rows={users} keyFn={(u) => u.id} empty="Хэрэглэгч байхгүй" />

      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              ← Өмнөх
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40 hover:bg-gray-50"
            >
              Дараах →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      <p className="text-xs text-gray-400">{unit}</p>
    </div>
  );
}
