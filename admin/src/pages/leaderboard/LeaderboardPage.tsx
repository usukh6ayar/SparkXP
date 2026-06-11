import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';

interface Entry {
  rank: number;
  userId: string;
  fullName: string;
  province: string | null;
  district: string | null;
  xp: number;
}

const SCOPES = [
  { value: 'global',   label: '🌏 Улс' },
  { value: 'province', label: '🏔️ Аймаг / Хот' },
  { value: 'district', label: '🏙️ Дүүрэг' },
];

const PERIODS = [
  { value: 'weekly',   label: '7 хоног' },
  { value: 'monthly',  label: 'Сар' },
  { value: 'all_time', label: 'Бүх цаг' },
];

const MN_PROVINCES = [
  'Улаанбаатар','Архангай','Баян-Өлгий','Баянхонгор','Булган','Говь-Алтай',
  'Говьсүмбэр','Дархан-Уул','Дорноговь','Дорнод','Дундговь','Завхан','Орхон',
  'Өвөрхангай','Өмнөговь','Сүхбаатар','Сэлэнгэ','Төв','Увс','Ховд','Хөвсгөл','Хэнтий',
];

const UB_DISTRICTS = [
  'Багануур','Багахангай','Баянгол','Баянзүрх','Налайх',
  'Сонгинохайрхан','Сүхбаатар','Хан-Уул','Чингэлтэй',
];

const xpColor = (rank: number) => {
  if (rank === 1) return 'text-amber-500 font-bold';
  if (rank === 2) return 'text-gray-400 font-semibold';
  if (rank === 3) return 'text-amber-700 font-semibold';
  return 'text-gray-600';
};

const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const [scope, setScope] = useState('global');
  const [period, setPeriod] = useState('weekly');
  const [value, setValue] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ scope, period, limit: '20' });
      if (value) qs.set('value', value);
      const data = await api.get<Entry[]>(`/leaderboard/top?${qs}`);
      setEntries(Array.isArray(data) ? data : []);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [scope, period, value]);

  useEffect(() => { load(); }, [load]);

  const valueOptions = scope === 'district' ? UB_DISTRICTS : MN_PROVINCES;
  const showValueSelect = scope !== 'global';

  return (
    <>
      <PageHeader title="Өрсөлдөөн" description="XP-ээр жагсаасан хэрэглэгчид" />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Scope tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              onClick={() => { setScope(s.value); setValue(''); }}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                scope === s.value
                  ? 'bg-navy text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Period tabs */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-primary text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Province / district select */}
        {showValueSelect && (
          <select
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          >
            <option value="">— {scope === 'district' ? 'Дүүрэг сонгох' : 'Аймаг/хот сонгох'} —</option>
            {valueOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-400">Уншиж байна...</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400">
          Өгөгдөл байхгүй — хэрэглэгчид XP цуглуулсны дараа харагдана
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500 w-12">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Хэрэглэгч</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Байршил</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">XP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.userId} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className={`px-4 py-3 ${xpColor(e.rank)}`}>
                    {medals[e.rank] ?? e.rank}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{e.fullName}</td>
                  <td className="px-4 py-3">
                    {e.province ? (
                      <span className="text-gray-500">
                        {e.province}{e.district ? ` · ${e.district}` : ''}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Badge color="blue">⚡ {e.xp.toLocaleString()}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
