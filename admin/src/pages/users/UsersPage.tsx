import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Select } from '../../components/Select';

interface User {
  id: string; email: string; fullName: string;
  role: string; xp: number; sparks: number;
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

export default function UsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');

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
    (u) => u.email.includes(search) || u.fullName.toLowerCase().includes(search.toLowerCase()),
  );

  const columns = [
    {
      key: 'name', header: 'Хэрэглэгч', render: (u: User) => (
        <div>
          <p className="font-medium">{u.fullName}</p>
          <p className="text-xs text-gray-400">{u.email}</p>
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
      <div className="mb-4">
        <input
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-64 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="Имэйл эсвэл нэрээр хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <Table columns={columns} rows={filtered} keyFn={(u) => u.id} empty="Хэрэглэгч олдсонгүй" />
    </>
  );
}
