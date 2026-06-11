import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';

interface Payment {
  id: string; amount: number; currency: string;
  status: string; provider: string | null; createdAt: string;
  user?: { email: string };
}

const statusColors: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  paid: 'green', pending: 'yellow', failed: 'red', refunded: 'gray',
};

export default function MonitorPage() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    api.get<Payment[]>('/payments').then(setPayments).catch(() => {});
  }, []);

  const paymentColumns = [
    { key: 'user', header: 'Хэрэглэгч', render: (p: Payment) => p.user?.email ?? '—' },
    {
      key: 'amount', header: 'Дүн', render: (p: Payment) =>
        <span className="font-medium">{p.amount.toLocaleString()} {p.currency}</span>,
    },
    { key: 'provider', header: 'Систем', render: (p: Payment) => p.provider ?? '—' },
    {
      key: 'status', header: 'Статус', render: (p: Payment) =>
        <Badge color={statusColors[p.status] ?? 'gray'}>{p.status}</Badge>,
    },
    {
      key: 'date', header: 'Огноо', render: (p: Payment) =>
        new Date(p.createdAt).toLocaleDateString('mn-MN'),
    },
  ];

  return (
    <>
      <PageHeader title="Монитор" description="Төлбөр ба системийн мэдээлэл" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
        <StatCard label="Нийт төлбөр" value={payments.length} unit="тоо" />
        <StatCard
          label="Нийт орлого"
          value={payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0).toLocaleString()}
          unit="MNT"
        />
        <StatCard
          label="Хүлээгдэж буй"
          value={payments.filter(p => p.status === 'pending').length}
          unit="тоо"
        />
      </div>

      <h2 className="text-lg font-semibold text-gray-800 mb-3">Төлбөрийн жагсаалт</h2>
      <Table columns={paymentColumns} rows={payments} keyFn={(p) => p.id} empty="Төлбөр байхгүй" />
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
