import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { FormActions } from '../../components/FormActions';
import { Table } from '../../components/Table';
import { formatDate } from '../../lib/utils';
import { endOfDayIso, KIND_OPTIONS, type Plan, type Promo, type PromoKind, type Redemption } from './types';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Алдаа гарлаа');
const planOptions = (plans: Plan[]) => [
  { value: '', label: 'Багц сонгох...' },
  ...plans.map((p) => ({ value: p.id, label: `${p.name} — ${p.priceAmount.toLocaleString()}₮` })),
];

/** Create a code, or edit an existing one's campaign settings. */
export function PromoFormModal({
  plans, editing, onClose, onSaved,
}: { plans: Plan[]; editing: Promo | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: editing?.name ?? '',
    code: '',
    kind: (editing?.kind ?? 'free_access') as PromoKind,
    value: String(editing?.value ?? 7),
    planId: editing?.planId ?? '',
    validFrom: editing?.validFrom?.slice(0, 10) ?? '',
    validUntil: editing?.validUntil?.slice(0, 10) ?? '',
    usageLimit: editing?.usageLimit ? String(editing.usageLimit) : '',
    note: editing?.note ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  async function save() {
    if (!form.name.trim()) return setError('Нэр оруулна уу');
    setSaving(true); setError('');
    const shared = {
      name: form.name,
      validFrom: form.validFrom ? new Date(`${form.validFrom}T00:00:00`).toISOString() : null,
      validUntil: endOfDayIso(form.validUntil) ?? null,
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      note: form.note || null,
    };
    try {
      if (editing) {
        await api.patch(`/admin/promos/${editing.id}`, shared);
      } else {
        await api.post('/admin/promos', {
          ...shared,
          code: form.code || undefined,
          kind: form.kind,
          value: Number(form.value),
          planId: form.planId || undefined,
          validFrom: shared.validFrom ?? undefined,
          validUntil: shared.validUntil ?? undefined,
          usageLimit: shared.usageLimit ?? undefined,
          note: shared.note ?? undefined,
        });
      }
      onSaved();
    } catch (e) {
      setError(errorText(e));
    } finally { setSaving(false); }
  }

  return (
    <Modal title={editing ? `Промо засах — ${editing.code}` : 'Промо код үүсгэх'} onClose={onClose}>
      <div className="space-y-4">
        <Input label="Нэр (дотоод)" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Шинэ жилийн урамшуулал" />
        {!editing && (
          <>
            <Input label="Код (хоосон бол автоматаар)" value={form.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="NEWYEAR2027" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Төрөл" options={KIND_OPTIONS} value={form.kind} onChange={(e) => set({ kind: e.target.value as PromoKind })} />
              <Input label={form.kind === 'free_access' ? 'Хоног' : form.kind === 'discount_percent' ? 'Хувь (%)' : 'Дүн (₮)'} type="number" min={1} value={form.value} onChange={(e) => set({ value: e.target.value })} />
            </div>
            <Select
              label={form.kind === 'free_access' ? 'Олгох багц' : 'Багц (хоосон = бүх багц)'}
              options={planOptions(plans)}
              value={form.planId}
              onChange={(e) => set({ planId: e.target.value })}
            />
          </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Эхлэх огноо" type="date" value={form.validFrom} onChange={(e) => set({ validFrom: e.target.value })} />
          <Input label="Дуусах огноо" type="date" value={form.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
        </div>
        <Input label="Ашиглах хязгаар (хоосон = хязгааргүй)" type="number" min={1} value={form.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} />
        <Input label="Тэмдэглэл" value={form.note} onChange={(e) => set({ note: e.target.value })} />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <FormActions onCancel={onClose} onSave={save} saving={saving} />
      </div>
    </Modal>
  );
}

/**
 * Influencer 7-day access (task #6), both ways the brief asked for:
 * straight onto an account by email, or as a code for N people.
 */
export function InfluencerModal({ plans, onClose, onSaved }: { plans: Plan[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [mode, setMode] = useState<'account' | 'code'>('account');
  const [form, setForm] = useState({ planId: '', email: '', days: '7', usageLimit: '1', validUntil: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  async function save() {
    if (!form.planId) return setError('Олгох багцаа сонгоно уу');
    if (mode === 'account' && !form.email.trim()) return setError('Хэрэглэгчийн имэйл оруулна уу');
    setSaving(true); setError('');
    try {
      const res = await api.post<{ promo: Promo }>('/admin/promos/influencer', {
        planId: form.planId,
        days: Number(form.days) || 7,
        email: mode === 'account' ? form.email.trim() : undefined,
        usageLimit: mode === 'code' ? Number(form.usageLimit) || 1 : undefined,
        validUntil: endOfDayIso(form.validUntil),
        note: form.note || undefined,
      });
      onSaved(mode === 'account' ? `${form.email} — ${form.days} хоногийн эрх олгогдлоо` : `Код үүслээ: ${res.promo.code}`);
    } catch (e) {
      setError(errorText(e));
    } finally { setSaving(false); }
  }

  const tab = (key: typeof mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(key)}
      className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium ${mode === key ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white text-gray-600'}`}
    >
      {label}
    </button>
  );

  return (
    <Modal title="Influencer эрх" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-2">{tab('account', 'Хэрэглэгчид шууд')}{tab('code', 'Код үүсгэх')}</div>
        <Select label="Олгох багц" options={planOptions(plans)} value={form.planId} onChange={(e) => set({ planId: e.target.value })} />
        <Input label="Хоног" type="number" min={1} value={form.days} onChange={(e) => set({ days: e.target.value })} />
        {mode === 'account' ? (
          <Input label="Хэрэглэгчийн имэйл" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="influencer@gmail.com" />
        ) : (
          <>
            <Input label="Хэдэн хүн ашиглах (1 = нэг хүнд)" type="number" min={1} value={form.usageLimit} onChange={(e) => set({ usageLimit: e.target.value })} />
            <Input label="Код идэвхжүүлэх эцсийн огноо" type="date" value={form.validUntil} onChange={(e) => set({ validUntil: e.target.value })} />
          </>
        )}
        <Input label="Тэмдэглэл (жишээ: @username, Instagram)" value={form.note} onChange={(e) => set({ note: e.target.value })} />
        <p className="text-xs text-gray-500">
          Эрх нь олгосноос хойш {form.days || 7} хоногийн дараа автоматаар дуусна. Хэрэглэгчид өөр идэвхтэй багц байвал олгохгүй.
        </p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <FormActions onCancel={onClose} onSave={save} saving={saving} saveLabel={mode === 'account' ? 'Эрх олгох' : 'Код үүсгэх'} />
      </div>
    </Modal>
  );
}

/** Who used a code, when, and what it gave them. */
export function HistoryModal({ promo, onClose }: { promo: Promo; onClose: () => void }) {
  const [rows, setRows] = useState<Redemption[] | null>(null);
  useEffect(() => {
    api.get<Redemption[]>(`/admin/promos/${promo.id}/redemptions`).then(setRows).catch(() => setRows([]));
  }, [promo.id]);

  const columns = [
    { key: 'user', header: 'Хэрэглэгч', render: (r: Redemption) => <div><div className="font-medium">{r.user.fullName}</div><div className="text-xs text-gray-400">{r.user.email}</div></div> },
    { key: 'at', header: 'Ашигласан', render: (r: Redemption) => formatDate(r.createdAt) },
    { key: 'until', header: 'Эрх дуусах', render: (r: Redemption) => (r.accessUntil ? formatDate(r.accessUntil) : r.paymentId ? 'Төлбөрт' : '—') },
  ];

  return (
    <Modal title={`Ашигласан түүх — ${promo.code}`} onClose={onClose} size="lg">
      <Table columns={columns} rows={rows ?? []} keyFn={(r) => r.id} loading={rows === null} skeletonRows={3} empty="Хэн ч ашиглаагүй байна" />
    </Modal>
  );
}
