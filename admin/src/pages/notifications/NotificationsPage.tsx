import { useState, useEffect, useCallback } from 'react';
import { Bell, Send } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';

interface Notification {
  id: string;
  title: string;
  body: string;
  targetRole: string | null;
  sentCount: number;
  createdAt: string;
}

const ROLE_OPTIONS = [
  { value: '',        label: 'Бүх хэрэглэгч' },
  { value: 'student', label: 'Сурагч' },
  { value: 'teacher', label: 'Багш' },
  { value: 'admin',   label: 'Админ' },
];

const ROLE_LABELS: Record<string, string> = {
  student: 'Сурагч', teacher: 'Багш', admin: 'Админ',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [form, setForm] = useState({ title: '', body: '', targetRole: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api.get<Notification[]>('/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function send() {
    if (!form.title.trim()) { setError('Гарчиг оруулна уу'); return; }
    if (!form.body.trim())  { setError('Мэдэгдлийн текст оруулна уу'); return; }
    setSending(true); setError(''); setSuccess('');
    try {
      const res = await api.post<{ sentCount: number }>('/notifications/broadcast', {
        title: form.title.trim(),
        body: form.body.trim(),
        targetRole: form.targetRole || null,
      });
      setSuccess(`Мэдэгдэл ${res.sentCount} хэрэглэгчид бүртгэгдлээ ✓`);
      setForm({ title: '', body: '', targetRole: '' });
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSending(false); }
  }

  const columns = [
    {
      key: 'title', header: 'Гарчиг',
      render: (n: Notification) => <span className="font-medium">{n.title}</span>,
    },
    {
      key: 'body', header: 'Мэдэгдэл',
      render: (n: Notification) => (
        <span className="text-sm text-gray-600 line-clamp-1 max-w-xs block">{n.body}</span>
      ),
    },
    {
      key: 'target', header: 'Хүлээн авагч',
      render: (n: Notification) => (
        <Badge color="blue">
          {n.targetRole ? (ROLE_LABELS[n.targetRole] ?? n.targetRole) : 'Бүгд'}
        </Badge>
      ),
    },
    {
      key: 'sent', header: 'Хэрэглэгч тоо',
      render: (n: Notification) => <span className="text-gray-700">{n.sentCount}</span>,
    },
    {
      key: 'date', header: 'Илгээсэн огноо',
      render: (n: Notification) => new Date(n.createdAt).toLocaleDateString('mn-MN'),
    },
  ];

  return (
    <>
      <PageHeader title="Мэдэгдэл" description="Хэрэглэгчдэд push notification явуулах" />

      {/* Compose card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm mb-8 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-gray-800">Шинэ мэдэгдэл</h2>
        </div>

        <Input
          label="Гарчиг"
          value={form.title}
          onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="жишээ: Шинэ хичээл нэмэгдлээ! 🎉"
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Мэдэгдлийн текст</label>
          <textarea
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
            rows={3}
            placeholder="Мэдэгдлийн дэлгэрэнгүй мэдээлэл..."
            value={form.body}
            onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
          />
        </div>

        <Select
          label="Хүлээн авагч"
          options={ROLE_OPTIONS}
          value={form.targetRole}
          onChange={(e) => setForm(f => ({ ...f, targetRole: e.target.value }))}
        />

        {error   && <p className="text-sm text-red-500">{error}</p>}
        {success && <p className="text-sm text-green-600 font-medium">{success}</p>}

        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">
            ⚠️ Expo Push API холбогдоогүй тул одоохондоо зөвхөн бүртгэлд хадгалагдана
          </p>
          <Button onClick={send} disabled={sending}>
            <Send className="h-4 w-4" />
            {sending ? 'Явуулж байна...' : 'Явуулах'}
          </Button>
        </div>
      </div>

      {/* History */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Илгээсэн мэдэгдлүүд</h2>
      <Table
        columns={columns}
        rows={notifications}
        keyFn={(n) => n.id}
        empty="Мэдэгдэл илгээгдээгүй байна"
      />
    </>
  );
}
