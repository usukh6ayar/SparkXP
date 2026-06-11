import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';

interface Buddy {
  slug: string;
  name: string;
  title: string;
  description: string;
  emoji: string;
  pricing: {
    extraMessagesAmount: number;
    extraMessagesCost: number;
    voiceMinuteCost: number | null;
  };
}

interface BuddyStat {
  slug: string;
  totalMessages: number;
  totalTokens: number;
  costMicroUsd: number;
}

const CARD_COLORS: Record<string, { bg: string; ring: string; badge: string }> = {
  cop:    { bg: 'from-blue-50 to-indigo-50',   ring: 'ring-indigo-200', badge: 'bg-indigo-100 text-indigo-700' },
  doctor: { bg: 'from-green-50 to-emerald-50', ring: 'ring-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
};

export default function AiBuddyPage() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [stats, setStats] = useState<BuddyStat[]>([]);

  useEffect(() => {
    api.get<Buddy[]>('/ai/buddies').then(setBuddies).catch(() => {});
    api.get<BuddyStat[]>('/ai/buddy-stats').then(setStats).catch(() => {});
  }, []);

  const statFor = (slug: string) => stats.find((s) => s.slug === slug);

  // Total across all buddies
  const totalMessages = stats.reduce((s, x) => s + x.totalMessages, 0);
  const totalCostUsd = stats.reduce((s, x) => s + x.costMicroUsd, 0) / 1_000_000;

  return (
    <>
      <PageHeader title="AI Buddy" description="Тусламжийн дүрүүд ба хэрэглээний статистик" />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <SummaryCard label="Нийт мессеж" value={totalMessages.toLocaleString()} unit="ширхэг" />
        <SummaryCard label="Нийт зардал" value={`$${totalCostUsd.toFixed(4)}`} unit="USD" />
        <SummaryCard label="Идэвхтэй buddy" value={buddies.length} unit="дүр" />
        <SummaryCard label="Статус" value="Бэлэн" unit="MVP" />
      </div>

      {/* Buddy cards */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Дүрүүд</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-10">
        {buddies.map((buddy) => {
          const st = statFor(buddy.slug);
          const colors = CARD_COLORS[buddy.slug] ?? { bg: 'from-gray-50 to-gray-100', ring: 'ring-gray-200', badge: 'bg-gray-100 text-gray-700' };
          const pct = totalMessages > 0 ? Math.round(((st?.totalMessages ?? 0) / totalMessages) * 100) : 0;

          return (
            <div
              key={buddy.slug}
              className={`rounded-2xl bg-gradient-to-br ${colors.bg} ring-1 ${colors.ring} p-6 shadow-sm`}
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="text-5xl leading-none">{buddy.emoji}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-bold text-gray-900">{buddy.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                      {buddy.title}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">{buddy.description}</p>
                </div>
              </div>

              {/* Usage bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Хэрэглээ</span>
                  <span>{st?.totalMessages ?? 0} мессеж ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <MiniStat label="Мессеж" value={(st?.totalMessages ?? 0).toLocaleString()} />
                <MiniStat label="Токен" value={(st?.totalTokens ?? 0).toLocaleString()} />
                <MiniStat label="Зардал" value={`$${((st?.costMicroUsd ?? 0) / 1_000_000).toFixed(4)}`} />
              </div>

              {/* Pricing info */}
              <div className="border-t border-black/5 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Үнийн жишээ (план-аас тусдаа)
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-white/60 px-2 py-1 text-gray-700">
                    +{buddy.pricing.extraMessagesAmount} мессеж → {buddy.pricing.extraMessagesCost.toLocaleString()} ₮
                  </span>
                  {buddy.pricing.voiceMinuteCost != null && (
                    <span className="rounded-lg bg-white/60 px-2 py-1 text-gray-700">
                      🎙️ 1 мин дуу → {buddy.pricing.voiceMinuteCost} ₮
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Анхаарна уу:</strong> Статистик нь mobile апп дээр buddy сонголт нэмэгдсэний дараа бодит тоо харуулна.
        Одоогоор ашиглалт 0 байгаа нь хэвийн — backend бэлэн, mobile холболт хийгдэх шаардлагатай.
      </div>
    </>
  );
}

function SummaryCard({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">{value}</p>
      <p className="text-xs text-gray-400">{unit}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/60 p-2 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-semibold text-gray-800 text-sm">{value}</p>
    </div>
  );
}
