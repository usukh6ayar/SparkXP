import { useState, useEffect, useCallback } from 'react';
import { Trash2, Trophy, Phone, AtSign } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Select } from '../../components/Select';
import { Modal } from '../../components/Modal';

interface User {
  id: string; email: string; fullName: string;
  role: string; xp: number; sparks: number;
  username: string | null; phone: string | null;
  trophies: string[] | null;
}

const roleOptions = [
  { value: 'student',    label: 'Оюутан' },
  { value: 'teacher',    label: 'Багш' },
  { value: 'moderator',  label: 'Модератор' },
  { value: 'admin',      label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const roleColors: Record<string, 'gray' | 'blue' | 'yellow' | 'red'> = {
  student: 'gray', teacher: 'blue', moderator: 'blue', admin: 'yellow', super_admin: 'red',
};

const TROPHY_DEFS: Record<string, { label: string; emoji: string }> = {
  first_quiz:   { label: 'Анхны сорил', emoji: '🎯' },
  streak_7:     { label: '7 өдрийн streak', emoji: '🔥' },
  streak_30:    { label: '30 өдрийн streak', emoji: '⚡' },
  xp_100:       { label: '100 XP', emoji: '🌟' },
  xp_1000:      { label: '1000 XP', emoji: '💎' },
  top_class:    { label: 'Ангийн тэргүүн', emoji: '🥇' },
  word_master:  { label: '100 үг цээжлэсэн', emoji: '📚' },
  lesson_5:     { label: '5 хичээл дуусгасан', emoji: '🎓' },
};

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [trophyUser, setTrophyUser] = useState<User | null>(null);

  const load = useCallback(async () => {
    const data = await api.get<{ items: User[] }>('/users');
    setUsers(data.items ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeRole(userId: string, role: string) {
    await api.patch(`/users/${userId}`, { role });
    load();
  }

  async function remove(u: User) {
    if (u.id === me?.id) { alert('Өөрийгөө устгах боломжгүй'); return; }
    if (!confirm(`${u.email}-г устгах уу?`)) return;
    await api.delete(`/users/${u.id}`);
    load();
  }

  const filtered = users.filter(
    (u) =>
      u.email.includes(search) ||
      u.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (u.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (u.phone ?? '').includes(search),
  );

  const columns = [
    {
      key: 'name', header: 'Хэрэглэгч', render: (u: User) => (
        <div>
          <p className="font-medium">{u.fullName}</p>
          <p className="text-xs text-gray-400">{u.email}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {u.username && (
              <span className="flex items-center gap-1 text-xs text-indigo-500">
                <AtSign className="h-3 w-3" />{u.username}
              </span>
            )}
            {u.phone && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Phone className="h-3 w-3" />{u.phone}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'role', header: 'Үүрэг', render: (u: User) => (
        me?.role === 'super_admin' ? (
          <Select
            options={roleOptions}
            value={u.role}
            onChange={(e) => changeRole(u.id, e.target.value)}
            className="py-1 text-xs"
          />
        ) : (
          <Badge color={roleColors[u.role] ?? 'gray'}>{u.role}</Badge>
        )
      ),
    },
    { key: 'xp', header: 'XP', render: (u: User) => <span className="text-primary font-medium">⚡ {u.xp}</span> },
    { key: 'sparks', header: 'Sparks', render: (u: User) => <span className="text-amber font-medium">✨ {u.sparks}</span> },
    {
      key: 'trophies', header: 'Trophy', render: (u: User) => {
        const count = (u.trophies ?? []).length;
        return (
          <button
            onClick={() => setTrophyUser(u)}
            className="flex items-center gap-1 text-sm hover:text-amber transition-colors"
          >
            <Trophy className="h-4 w-4 text-amber-400" />
            <span className={count > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{count}</span>
          </button>
        );
      },
    },
    {
      key: 'actions', header: '', render: (u: User) => (
        <Button variant="ghost" size="sm" onClick={() => remove(u)}>
          <Trash2 className="h-4 w-4 text-red-400" />
        </Button>
      ), className: 'text-right',
    },
  ];

  return (
    <>
      <PageHeader title="Хэрэглэгчид" description={`Нийт: ${users.length}`} />
      <div className="mb-4 flex gap-3 flex-wrap">
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-72 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Нэр, имэйл, username, утас хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 text-xs text-gray-500 items-center">
          <span>🎓 Оюутан: {users.filter(u => u.role === 'student').length}</span>
          <span>📚 Багш: {users.filter(u => u.role === 'teacher').length}</span>
        </div>
      </div>
      <Table columns={columns} rows={filtered} keyFn={(u) => u.id} empty="Хэрэглэгч олдсонгүй" />

      {/* Trophy modal */}
      {trophyUser && (
        <Modal title={`🏆 ${trophyUser.fullName} — Trophy`} onClose={() => setTrophyUser(null)}>
          {(trophyUser.trophies ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">Одоогоор trophy байхгүй байна</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(trophyUser.trophies ?? []).map((slug) => {
                const def = TROPHY_DEFS[slug] ?? { label: slug, emoji: '🏅' };
                return (
                  <div key={slug} className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 border border-amber-100">
                    <span className="text-xl">{def.emoji}</span>
                    <span className="text-sm font-medium text-amber-800">{def.label}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400">Trophy-г автоматаар олгохын тулд mobile app-тай холбоно.</p>
          </div>
        </Modal>
      )}
    </>
  );
}
