import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
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
  cop:      { bg: 'from-blue-50 to-indigo-50',    ring: 'ring-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  doctor:   { bg: 'from-green-50 to-emerald-50',  ring: 'ring-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  lawyer:   { bg: 'from-amber-50 to-yellow-50',   ring: 'ring-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  engineer: { bg: 'from-violet-50 to-purple-50',  ring: 'ring-violet-200',  badge: 'bg-violet-100 text-violet-700' },
  business: { bg: 'from-rose-50 to-pink-50',      ring: 'ring-rose-200',    badge: 'bg-rose-100 text-rose-700' },
};

export default function AiBuddyPage() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [stats, setStats] = useState<BuddyStat[]>([]);
  const [showAddNote, setShowAddNote] = useState(false);

  useEffect(() => {
    api.get<Buddy[]>('/ai/buddies').then(setBuddies).catch(() => {});
    api.get<BuddyStat[]>('/ai/buddy-stats').then(setStats).catch(() => {});
  }, []);

  const statFor = (slug: string) => stats.find((s) => s.slug === slug);

  const totalMessages = stats.reduce((s, x) => s + x.totalMessages, 0);
  const totalCostUsd = stats.reduce((s, x) => s + x.costMicroUsd, 0) / 1_000_000;

  return (
    <>
      <PageHeader
        title="AI Buddy"
        description="Тусламжийн дүрүүд ба хэрэглээний статистик"
        action={
          <button
            onClick={() => setShowAddNote(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> AI Buddy нэмэх
          </button>
        }
      />

      {/* Add note banner */}
      {showAddNote && (
        <div className="mb-6 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-800 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-1">AI Buddy нэмэхэд backend дээр тохируулна</p>
            <p className="text-indigo-600">
              Шинэ buddy нэмэхийн тулд <span className="font-mono font-medium">backend/src/ai-gateway/buddies.ts</span> файлд slug, нэр, тайлбар, emoji, үнийн мэдээллийг нэмж, backend-г дахин deploy хийнэ.
            </p>
          </div>
          <button onClick={() => setShowAddNote(false)} className="text-indigo-400 hover:text-indigo-700 text-lg leading-none shrink-0">✕</button>
        </div>
      )}

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
              {/* Header — emoji + title only, no personal name */}
              <div className="flex items-center gap-4 mb-4">
                <div className="text-5xl leading-none">{buddy.emoji}</div>
                <div className="flex-1">
                  <span className={`inline-block text-sm px-3 py-1 rounded-full font-semibold ${colors.badge}`}>
                    {buddy.title}
                  </span>
                  <p className="mt-2 text-sm text-gray-600">{buddy.description}</p>
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

        {/* Add new buddy placeholder card */}
        <button
          onClick={() => setShowAddNote(true)}
          className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-3 min-h-[200px]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-gray-400 hover:bg-primary/10 transition-colors">
            <Plus className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-gray-500">AI Buddy нэмэх</p>
        </button>
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
