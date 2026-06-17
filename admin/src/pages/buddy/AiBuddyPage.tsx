import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

interface Buddy {
  slug: string;
  name: string;
  title: string;
  description: string;
  emoji: string;
  systemPrompt: string;
  extraMessagesAmount: number;
  extraMessagesCost: number;
  voiceMinuteCost: number | null;
  isActive: boolean;
  sortOrder: number;
}

interface BuddyStat {
  slug: string;
  totalMessages: number;
  totalTokens: number;
  costMicroUsd: number;
}

type BuddyForm = Omit<Buddy, 'isActive' | 'sortOrder' | 'voiceMinuteCost'> & {
  voiceMinuteCostStr: string;
};

const emptyForm = (): BuddyForm => ({
  slug: '', name: '', title: '', description: '',
  emoji: '🤖', systemPrompt: '',
  extraMessagesAmount: 50, extraMessagesCost: 5000,
  voiceMinuteCostStr: '200',
});

const CARD_COLORS: Record<string, { bg: string; ring: string; badge: string }> = {
  cop:      { bg: 'from-blue-50 to-indigo-50',   ring: 'ring-indigo-200',  badge: 'bg-indigo-100 text-indigo-700' },
  doctor:   { bg: 'from-green-50 to-emerald-50', ring: 'ring-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  lawyer:   { bg: 'from-amber-50 to-yellow-50',  ring: 'ring-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  engineer: { bg: 'from-violet-50 to-purple-50', ring: 'ring-violet-200',  badge: 'bg-violet-100 text-violet-700' },
  business: { bg: 'from-rose-50 to-pink-50',     ring: 'ring-rose-200',    badge: 'bg-rose-100 text-rose-700' },
};
const DEFAULT_COLORS = { bg: 'from-gray-50 to-gray-100', ring: 'ring-gray-200', badge: 'bg-gray-100 text-gray-700' };

export default function AiBuddyPage() {
  const [buddies, setBuddies] = useState<Buddy[]>([]);
  const [stats, setStats] = useState<BuddyStat[]>([]);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Buddy | null>(null);
  const [form, setForm] = useState<BuddyForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<Buddy[]>('/ai/buddies').then(setBuddies).catch(() => {});
    api.get<BuddyStat[]>('/ai/buddy-stats').then(setStats).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const statFor = (slug: string) => stats.find((s) => s.slug === slug);
  const totalMessages = stats.reduce((s, x) => s + x.totalMessages, 0);
  const totalCostUsd = stats.reduce((s, x) => s + x.costMicroUsd, 0) / 1_000_000;

  function openCreate() {
    setForm(emptyForm()); setEditing(null); setError(''); setModal('create');
  }

  function openEdit(b: Buddy) {
    setForm({
      slug: b.slug, name: b.name, title: b.title,
      description: b.description, emoji: b.emoji,
      systemPrompt: b.systemPrompt,
      extraMessagesAmount: b.extraMessagesAmount,
      extraMessagesCost: b.extraMessagesCost,
      voiceMinuteCostStr: b.voiceMinuteCost != null ? String(b.voiceMinuteCost) : '',
    });
    setEditing(b); setError(''); setModal('edit');
  }

  async function save() {
    if (!form.slug.trim() || !form.title.trim() || !form.emoji.trim()) {
      setError('Slug, гарчиг, emoji заавал бөглөнө'); return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        slug: form.slug.trim(),
        name: form.name.trim(),
        title: form.title.trim(),
        description: form.description.trim(),
        emoji: form.emoji.trim(),
        systemPrompt: form.systemPrompt.trim(),
        extraMessagesAmount: Number(form.extraMessagesAmount),
        extraMessagesCost: Number(form.extraMessagesCost),
        voiceMinuteCost: form.voiceMinuteCostStr.trim() !== ''
          ? Number(form.voiceMinuteCostStr) : null,
      };
      if (modal === 'create') {
        await api.post('/ai/buddies', payload);
      } else if (editing) {
        await api.patch(`/ai/buddies/${editing.slug}`, payload);
      }
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(slug: string) {
    if (!confirm('AI Buddy устгах уу?')) return;
    await api.delete(`/ai/buddies/${slug}`);
    load();
  }

  function f(key: keyof BuddyForm, val: string | number) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  return (
    <>
      <PageHeader
        title="AI Buddy"
        description="Тусламжийн дүрүүд ба хэрэглээний статистик"
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> AI Buddy нэмэх
          </Button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <SummaryCard label="Нийт мессеж"   value={totalMessages.toLocaleString()} unit="ширхэг" />
        <SummaryCard label="Нийт зардал"   value={`$${totalCostUsd.toFixed(4)}`}  unit="USD" />
        <SummaryCard label="Идэвхтэй buddy" value={buddies.length}                  unit="дүр" />
        <SummaryCard label="Статус"         value="Бэлэн"                           unit="MVP" />
      </div>

      {/* Buddy cards */}
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Дүрүүд</h2>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 mb-10">
        {buddies.map((buddy) => {
          const st = statFor(buddy.slug);
          const colors = CARD_COLORS[buddy.slug] ?? DEFAULT_COLORS;
          const pct = totalMessages > 0 ? Math.round(((st?.totalMessages ?? 0) / totalMessages) * 100) : 0;

          return (
            <div key={buddy.slug}
              className={`rounded-2xl bg-gradient-to-br ${colors.bg} ring-1 ${colors.ring} p-6 shadow-sm`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4 flex-1">
                  <div className="text-5xl leading-none">{buddy.emoji}</div>
                  <div className="flex-1">
                    <span className={`inline-block text-sm px-3 py-1 rounded-full font-semibold ${colors.badge}`}>
                      {buddy.title}
                    </span>
                    <p className="mt-2 text-sm text-gray-600">{buddy.description}</p>
                  </div>
                </div>
                <div className="flex gap-1 ml-2 shrink-0">
                  <button onClick={() => openEdit(buddy)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-gray-700 transition-colors">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(buddy.slug)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-white/60 hover:text-red-500 transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Хэрэглээ</span>
                  <span>{st?.totalMessages ?? 0} мессеж ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <MiniStat label="Мессеж" value={(st?.totalMessages ?? 0).toLocaleString()} />
                <MiniStat label="Токен"  value={(st?.totalTokens ?? 0).toLocaleString()} />
                <MiniStat label="Зардал" value={`$${((st?.costMicroUsd ?? 0) / 1_000_000).toFixed(4)}`} />
              </div>

              <div className="border-t border-black/5 pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Үнийн жишээ</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-lg bg-white/60 px-2 py-1 text-gray-700">
                    +{buddy.extraMessagesAmount} мессеж → {buddy.extraMessagesCost.toLocaleString()} ₮
                  </span>
                  {buddy.voiceMinuteCost != null && (
                    <span className="rounded-lg bg-white/60 px-2 py-1 text-gray-700">
                      🎙️ 1 мин → {buddy.voiceMinuteCost} ₮
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Add placeholder */}
        <button onClick={openCreate}
          className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 shadow-sm hover:border-primary hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-3 min-h-[200px]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-gray-400">
            <Plus className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-gray-500">AI Buddy нэмэх</p>
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Анхаарна уу:</strong> Статистик нь mobile апп buddy сонголтыг дэмжсэний дараа бодит тоо харуулна.
      </div>

      {/* Create / Edit Modal */}
      {modal && (
        <Modal title={modal === 'create' ? 'AI Buddy нэмэх' : 'AI Buddy засах'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-1">
                <label className="text-sm font-medium text-gray-700 block mb-1">Emoji</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-2xl text-center focus:border-primary focus:outline-none"
                  value={form.emoji}
                  onChange={(e) => f('emoji', e.target.value)}
                  maxLength={4}
                />
              </div>
              <div className="col-span-3">
                <Input label="Slug (URL-д ашиглагдана)"
                  value={form.slug} placeholder="cop, doctor, teacher..."
                  onChange={(e) => f('slug', e.target.value)}
                  disabled={modal === 'edit'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Нэр" value={form.name} placeholder="Цагдаа Болд"
                onChange={(e) => f('name', e.target.value)} />
              <Input label="Гарчиг / Мэргэжил" value={form.title} placeholder="Цагдаагийн дарга"
                onChange={(e) => f('title', e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Тайлбар</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none"
                rows={2}
                placeholder="Хуулийн болон албан ёсны Англи хэл заана..."
                value={form.description}
                onChange={(e) => f('description', e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                System Prompt <span className="text-gray-400 font-normal">(AI-д өгөх заавар)</span>
              </label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none font-mono"
                rows={5}
                placeholder="Та EnglishXP платформын ... гэдэг AI туслах. Та ... дүрд тоглон..."
                value={form.systemPrompt}
                onChange={(e) => f('systemPrompt', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="+Мессеж тоо" type="number" min={1}
                value={form.extraMessagesAmount}
                onChange={(e) => f('extraMessagesAmount', Number(e.target.value))} />
              <Input label="Үнэ ₮" type="number" min={0}
                value={form.extraMessagesCost}
                onChange={(e) => f('extraMessagesCost', Number(e.target.value))} />
              <Input label="🎙 1 мин ₮ (хоосон=үгүй)" type="number" min={0}
                value={form.voiceMinuteCostStr}
                onChange={(e) => f('voiceMinuteCostStr', e.target.value)}
                placeholder="200" />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setModal(null)}>Болих</Button>
              <Button onClick={save} disabled={saving}>
                {saving ? 'Хадгалж байна...' : 'Хадгалах'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
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
