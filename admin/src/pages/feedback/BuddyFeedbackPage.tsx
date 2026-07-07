import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Pagination } from '../../components/Pagination';

interface Feedback {
  messageId: string;
  userId: string;
  buddySlug: string | null;
  reply: string;
  rating: 'up' | 'down' | string;
  reason: string | null;
  at: string | null;
  createdAt: string;
}

interface Page {
  items: Feedback[];
  total: number;
  page: number;
  limit: number;
}

export default function BuddyFeedbackPage() {
  const [data, setData] = useState<Page>({ items: [], total: 0, page: 1, limit: 20 });
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    api.get<Page>(`/ai/buddy/admin/feedback?page=${page}`).then(setData).catch(() => {});
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="AI Buddy санал"
        description="Хэрэглэгчдийн buddy хариултад өгсөн 👍/👎 үнэлгээ (муу хариултыг хянах)"
      />

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Огноо</th>
              <th className="px-4 py-3 font-medium">Үнэлгээ</th>
              <th className="px-4 py-3 font-medium">Buddy</th>
              <th className="px-4 py-3 font-medium">AI хариулт</th>
              <th className="px-4 py-3 font-medium">Шалтгаан</th>
              <th className="px-4 py-3 font-medium">Хэрэглэгч</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.items.map((fb) => (
              <tr key={fb.messageId} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(fb.at ?? fb.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  {fb.rating === 'up' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                      <ThumbsUp className="h-3 w-3" /> Сайшаасан
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <ThumbsDown className="h-3 w-3" /> Гомдол
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{fb.buddySlug ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700 max-w-md">{fb.reply}</td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{fb.reason || '—'}</td>
                <td className="px-4 py-3 text-gray-400 font-mono text-xs whitespace-nowrap">{fb.userId.slice(0, 8)}…</td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Одоогоор санал алга байна
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
