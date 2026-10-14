import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { ErrorBox } from '../../components/ErrorBox';
import { friendlyError } from '../../lib/errors';

type Action = 'dismiss' | 'remove_avatar' | 'reset_name';

interface Person {
  id: string;
  fullName: string;
  username: string | null;
  avatarUrl?: string | null;
}

interface Report {
  id: string;
  reason: 'photo' | 'name' | 'other';
  status: 'open' | 'resolved';
  action: Action | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: Person;
  reported: Person;
}

const REASON: Record<Report['reason'], string> = {
  photo: 'Зохисгүй зураг',
  name: 'Зохисгүй нэр',
  other: 'Бусад',
};

const ACTION: Record<Action, string> = {
  dismiss: 'Хэвээр үлдээв',
  remove_avatar: 'Зураг устгав',
  reset_name: 'Нэр шинэчлэв',
};

const CONFIRM: Record<Exclude<Action, 'dismiss'>, string> = {
  remove_avatar: 'Энэ хэрэглэгчийн профайл зургийг устгах уу?',
  reset_name: 'Нэрийг «SparkXP хэрэглэгч», username-ийг санамсаргүй болгох уу? Утсаар нэвтрэх нь хэвээр.',
};

const who = (p: Person) => (p.username ? `${p.fullName} (@${p.username})` : p.fullName);

/**
 * «Гомдол» — users reporting another user's photo or name from the app's
 * leaderboard (App Store guideline 1.2). Apple expects action within 24 hours,
 * so open reports sit on top and the sidebar shows their count.
 */
export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Report[]>('/admin/reports')
      .then((r) => {
        setReports(r);
        setError(null);
      })
      .catch((e) => setError(friendlyError(e)));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolve(r: Report, action: Action) {
    if (action !== 'dismiss' && !confirm(CONFIRM[action])) return;
    setBusy(r.id);
    try {
      await api.post(`/admin/reports/${r.id}/resolve`, { action });
      load();
    } catch (e) {
      alert(friendlyError(e));
    } finally {
      setBusy(null);
    }
  }

  const open = reports.filter((r) => r.status === 'open').length;

  return (
    <>
      <PageHeader
        title="Гомдол"
        description={`Хэрэглэгчийн зураг, нэрийн тухай мэдээлэл · ${open} шийдээгүй. 24 цагийн дотор шийднэ.`}
      />

      {error ? <ErrorBox message={error} onRetry={load} /> : null}

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">Огноо</th>
              <th className="px-4 py-3 font-medium">Мэдээлэгдсэн хэрэглэгч</th>
              <th className="px-4 py-3 font-medium">Шалтгаан</th>
              <th className="px-4 py-3 font-medium">Мэдээлсэн</th>
              <th className="px-4 py-3 font-medium">Шийдвэр</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reports.map((r) => (
              <tr key={r.id} className={r.status === 'open' ? 'bg-amber-50/40' : ''}>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {new Date(r.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {r.reported.avatarUrl ? (
                      <a href={r.reported.avatarUrl} target="_blank" rel="noreferrer">
                        <img src={r.reported.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                      </a>
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-gray-100" />
                    )}
                    <span className="font-medium text-gray-800">{who(r.reported)}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700">{REASON[r.reason]}</td>
                <td className="px-4 py-3 text-gray-500">{who(r.reporter)}</td>
                <td className="px-4 py-3">
                  {r.status === 'resolved' ? (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                      {r.action ? ACTION[r.action] : 'Шийдсэн'}
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(['remove_avatar', 'reset_name', 'dismiss'] as const).map((a) => (
                        <button
                          key={a}
                          disabled={busy === r.id || (a === 'remove_avatar' && !r.reported.avatarUrl)}
                          onClick={() => resolve(r, a)}
                          className={
                            a === 'dismiss'
                              ? 'rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40'
                              : 'rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40'
                          }
                        >
                          {a === 'dismiss' ? 'Хэвээр үлдээх' : a === 'remove_avatar' ? 'Зураг устгах' : 'Нэр шинэчлэх'}
                        </button>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Гомдол алга байна
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
