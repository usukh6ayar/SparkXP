import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Pagination } from '../../components/Pagination';

interface SafetyEvent {
  id: string;
  userId: string;
  sessionId: string | null;
  eventType: string;
  severity: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

interface Page {
  items: SafetyEvent[];
  total: number;
  page: number;
  limit: number;
}

const SEVERITY_STYLE: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
};

export default function SafetyEventsPage() {
  const [data, setData] = useState<Page>({ items: [], total: 0, page: 1, limit: 20 });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api.get<Page>(`/ai/buddy/admin/safety-events?page=${page}`).then(setData).catch(() => {});
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Аюулгүй байдлын лог"
        description="AI Buddy-гийн safety event-үүд (flagged / rate-limit / jailbreak)"
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Огноо</th>
              <th className="px-4 py-3 font-medium">Төрөл</th>
              <th className="px-4 py-3 font-medium">Ноцтой байдал</th>
              <th className="px-4 py-3 font-medium">Хэрэглэгч</th>
              <th className="px-4 py-3 font-medium">Дэлгэрэнгүй</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map((ev) => (
              <tr key={ev.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(ev.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-gray-800">{ev.eventType}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_STYLE[ev.severity] ?? SEVERITY_STYLE.low}`}>
                    {ev.severity}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{ev.userId.slice(0, 8)}…</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-md truncate">
                  {ev.details ? JSON.stringify(ev.details) : '—'}
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Одоогоор safety event алга байна 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={data.page} total={data.total} limit={data.limit} onPage={setPage} />
    </>
  );
}
