import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Volume2 } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { FormActions } from '../../components/FormActions';

/** Emotion + gesture tags the mobile avatar animates (kept in sync with backend). */
const EMOTION_TAGS = ['happy', 'curious', 'thinking', 'surprised', 'calm', 'encouraging', 'confused'];
const GESTURE_TAGS = ['small_nod', 'wave', 'thumbs_up', 'think_pose', 'idle', 'smile'];
const ALL_TAGS = [...EMOTION_TAGS, ...GESTURE_TAGS];

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
  voiceId: string | null;
  ttsParams: { voiceSettings?: Record<string, number> } | null;
  emotionMap: Record<string, string> | null;
  avatarAssetUrl: string | null;
  avatarThumbUrl: string | null;
}

interface BuddyStat {
  slug: string;
  totalMessages: number;
  totalTokens: number;
  costMicroUsd: number;
}

type BuddyForm = Omit<
  Buddy,
  'isActive' | 'sortOrder' | 'voiceMinuteCost' | 'ttsParams' | 'emotionMap' | 'voiceId' | 'avatarAssetUrl' | 'avatarThumbUrl'
> & {
  voiceMinuteCostStr: string;
  voiceId: string;
  avatarAssetUrl: string;
  avatarThumbUrl: string;
  stability: string;
  similarity: string;
  style: string;
  emotionMap: Record<string, string>;
};

const emptyForm = (): BuddyForm => ({
  slug: '', name: '', title: '', description: '',
  emoji: '🤖', systemPrompt: '',
  extraMessagesAmount: 50, extraMessagesCost: 5000,
  voiceMinuteCostStr: '200',
  voiceId: '', avatarAssetUrl: '', avatarThumbUrl: '',
  stability: '', similarity: '', style: '',
  emotionMap: {},
});

const CARD_COLORS: Record<string, { bg: string; ring: string; badge: string }> = {
  'electrical-engineer': { bg: 'from-yellow-50 to-amber-50',   ring: 'ring-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  'chef':                { bg: 'from-orange-50 to-red-50',     ring: 'ring-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  'pilot':               { bg: 'from-sky-50 to-blue-50',       ring: 'ring-sky-200',     badge: 'bg-sky-100 text-sky-700' },
  'journalist':          { bg: 'from-purple-50 to-fuchsia-50', ring: 'ring-purple-200',  badge: 'bg-purple-100 text-purple-700' },
  'cybersecurity':       { bg: 'from-slate-50 to-gray-100',    ring: 'ring-slate-200',   badge: 'bg-slate-100 text-slate-700' },
  'data-scientist':      { bg: 'from-teal-50 to-cyan-50',      ring: 'ring-teal-200',    badge: 'bg-teal-100 text-teal-700' },
  'architect':           { bg: 'from-stone-50 to-neutral-100', ring: 'ring-stone-200',   badge: 'bg-stone-100 text-stone-700' },
  'interior-designer':   { bg: 'from-rose-50 to-pink-50',      ring: 'ring-rose-200',    badge: 'bg-rose-100 text-rose-700' },
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
  const [testing, setTesting] = useState(false);

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
    const vs = b.ttsParams?.voiceSettings ?? {};
    setForm({
      slug: b.slug, name: b.name, title: b.title,
      description: b.description, emoji: b.emoji,
      systemPrompt: b.systemPrompt,
      extraMessagesAmount: b.extraMessagesAmount,
      extraMessagesCost: b.extraMessagesCost,
      voiceMinuteCostStr: b.voiceMinuteCost != null ? String(b.voiceMinuteCost) : '',
      voiceId: b.voiceId ?? '',
      avatarAssetUrl: b.avatarAssetUrl ?? '',
      avatarThumbUrl: b.avatarThumbUrl ?? '',
      stability: vs.stability != null ? String(vs.stability) : '',
      similarity: vs.similarity_boost != null ? String(vs.similarity_boost) : '',
      style: vs.style != null ? String(vs.style) : '',
      emotionMap: b.emotionMap ?? {},
    });
    setEditing(b); setError(''); setModal('edit');
  }

  async function save(keepOpen = false) {
    if (!form.slug.trim() || !form.title.trim() || !form.emoji.trim()) {
      setError('Slug, гарчиг, emoji заавал бөглөнө'); return;
    }
    setSaving(true); setError('');
    try {
      const voiceSettings: Record<string, number> = {};
      if (form.stability.trim() !== '') voiceSettings.stability = Number(form.stability);
      if (form.similarity.trim() !== '') voiceSettings.similarity_boost = Number(form.similarity);
      if (form.style.trim() !== '') voiceSettings.style = Number(form.style);
      // Only keep the emotion rows the admin actually filled in.
      const emotionMap = Object.fromEntries(
        Object.entries(form.emotionMap).filter(([, clip]) => clip.trim() !== ''),
      );
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
        voiceId: form.voiceId.trim() || undefined,
        ttsParams: Object.keys(voiceSettings).length ? { voiceSettings } : undefined,
        emotionMap: Object.keys(emotionMap).length ? emotionMap : undefined,
        avatarAssetUrl: form.avatarAssetUrl.trim() || undefined,
        avatarThumbUrl: form.avatarThumbUrl.trim() || undefined,
      };
      if (modal === 'create') {
        await api.post('/ai/buddies', payload);
      } else if (editing) {
        await api.patch(`/ai/buddies/${editing.slug}`, payload);
      }
      if (!keepOpen) setModal(null);
      load();
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

  function setEmotion(tag: string, clip: string) {
    setForm(prev => ({ ...prev, emotionMap: { ...prev.emotionMap, [tag]: clip } }));
  }

  /** Save current voice settings first (so the preview uses them), then play. */
  async function testVoice() {
    if (!editing) { setError('Эхлээд buddy-г хадгална'); return; }
    setTesting(true); setError('');
    try {
      await save(true);
      const res = await api.post<{ audio_url: string | null }>('/ai/buddy/admin/test-voice', {
        buddySlug: editing.slug,
        text: 'Hello! I am your English speaking buddy. What would you like to talk about today?',
      });
      if (res.audio_url) new Audio(res.audio_url).play().catch(() => {});
      else setError('Аудио үүсгэж чадсангүй (ELEVENLABS_API_KEY шалгана уу)');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Дуут тест амжилтгүй');
    } finally { setTesting(false); }
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

            {/* --- Voice + 3D avatar --- */}
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800">Дуу хоолой ба Avatar</h3>
                {modal === 'edit' && (
                  <Button variant="secondary" size="sm" onClick={testVoice} disabled={testing || saving}>
                    <Volume2 className="h-4 w-4" /> {testing ? 'Тест хийж байна…' : 'Дуу сонсох'}
                  </Button>
                )}
              </div>

              <Input label="ElevenLabs voice ID (хоосон=default)"
                value={form.voiceId} placeholder="EXAVITQu4vr4xnSDxMaL"
                onChange={(e) => f('voiceId', e.target.value)} />

              <div className="grid grid-cols-3 gap-3">
                <Input label="Stability (0–1)" type="number" min={0} max={1} step={0.05}
                  value={form.stability} onChange={(e) => f('stability', e.target.value)} placeholder="0.5" />
                <Input label="Similarity (0–1)" type="number" min={0} max={1} step={0.05}
                  value={form.similarity} onChange={(e) => f('similarity', e.target.value)} placeholder="0.75" />
                <Input label="Style (0–1)" type="number" min={0} max={1} step={0.05}
                  value={form.style} onChange={(e) => f('style', e.target.value)} placeholder="0" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="Avatar GLB URL" value={form.avatarAssetUrl}
                  placeholder="https://…/fox.glb"
                  onChange={(e) => f('avatarAssetUrl', e.target.value)} />
                <Input label="Avatar thumbnail URL" value={form.avatarThumbUrl}
                  placeholder="https://…/fox.png"
                  onChange={(e) => f('avatarThumbUrl', e.target.value)} />
              </div>

              <details className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-gray-600">
                  Emotion/gesture → animation clip (сонголттой)
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {ALL_TAGS.map((tag) => (
                    <div key={tag} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{tag}</span>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-primary focus:outline-none"
                        value={form.emotionMap[tag] ?? ''}
                        placeholder={tag}
                        onChange={(e) => setEmotion(tag, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <FormActions onCancel={() => setModal(null)} onSave={() => save()} saving={saving}
              className="flex justify-end gap-2 pt-2 border-t border-gray-100" />
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
