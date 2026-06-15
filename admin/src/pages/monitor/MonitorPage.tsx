import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';

interface Payment {
  id: string; amount: number; currency: string;
  status: string; provider: string | null; createdAt: string;
  metadata?: { type?: string; planName?: string; sparksToCredit?: number } | null;
  user?: { email: string; fullName: string };
}

interface Plan {
  id: string; name: string; slug: string;
  priceAmount: number; durationDays: number;
  features: string[] | null; isActive: boolean;
  voiceMinutesLimit: number | null;
  sttMinutesLimit: number | null;
  dictionaryAiLimit: number | null;
  aiTextTokensLimit: number | null;
  memoryMbLimit: number | null;
}

interface PlanForm {
  name: string; slug: string; priceAmount: string;
  durationDays: string; features: string; isActive: boolean;
  voiceMinutesLimit: string;
  sttMinutesLimit: string;
  dictionaryAiLimit: string;
  aiTextTokensLimit: string;
  memoryMbLimit: string;
}
const emptyPlanForm: PlanForm = {
  name: '', slug: '', priceAmount: '', durationDays: '30', features: '', isActive: true,
  voiceMinutesLimit: '', sttMinutesLimit: '', dictionaryAiLimit: '', aiTextTokensLimit: '', memoryMbLimit: '',
};

const statusColors: Record<string, 'green' | 'yellow' | 'red' | 'gray'> = {
  paid: 'green', pending: 'yellow', failed: 'red', refunded: 'gray',
};
const planColors: Record<string, 'blue' | 'yellow' | 'red'> = {
  standard: 'blue', plus: 'yellow', premier: 'red',
};

export default function MonitorPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const loadPlans = useCallback(() => {
    api.get<Plan[]>('/payments/plans').then(setPlans).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Payment[]>('/payments').then(setPayments).catch(() => {});
    loadPlans();
  }, [loadPlans]);

  const paidTotal = payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const planSales = payments.filter(p => p.status === 'paid' && p.metadata?.type === 'plan').length;

  // Auto-generate slug from name
  function handleNameChange(name: string) {
    const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    setPlanForm(f => ({ ...f, name, slug }));
  }

  async function savePlan() {
    if (!planForm.name.trim() || !planForm.slug.trim()) { setSaveError('Нэр болон slug оруулна уу'); return; }
    if (!planForm.priceAmount || isNaN(Number(planForm.priceAmount))) { setSaveError('Үнэ оруулна уу'); return; }
    setSaving(true); setSaveError('');
    try {
      const features = planForm.features
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean);
      const toLimit = (v: string) => v.trim() === '' ? null : Number(v);
      await api.post('/payments/plans', {
        name: planForm.name,
        slug: planForm.slug,
        priceAmount: Number(planForm.priceAmount),
        durationDays: Number(planForm.durationDays) || 30,
        features: features.length ? features : undefined,
        isActive: planForm.isActive,
        voiceMinutesLimit: toLimit(planForm.voiceMinutesLimit),
        sttMinutesLimit: toLimit(planForm.sttMinutesLimit),
        dictionaryAiLimit: toLimit(planForm.dictionaryAiLimit),
        aiTextTokensLimit: toLimit(planForm.aiTextTokensLimit),
        memoryMbLimit: toLimit(planForm.memoryMbLimit),
      });
      setPlanModal(false);
      setPlanForm(emptyPlanForm);
      loadPlans();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  const paymentColumns = [
    {
      key: 'user', header: 'Хэрэглэгч',
      render: (p: Payment) => (
        <div>
          <p className="font-medium text-sm">{p.user?.fullName ?? '—'}</p>
          <p className="text-xs text-gray-400">{p.user?.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'type', header: 'Төрөл',
      render: (p: Payment) => p.metadata?.type === 'plan'
        ? <Badge color={planColors[p.metadata?.planName?.toLowerCase() ?? ''] ?? 'blue'}>{p.metadata.planName} план</Badge>
        : <Badge color="gray">Sparks ✨{p.metadata?.sparksToCredit}</Badge>,
    },
    {
      key: 'amount', header: 'Дүн',
      render: (p: Payment) => <span className="font-medium">{p.amount.toLocaleString()} ₮</span>,
    },
    {
      key: 'status', header: 'Статус',
      render: (p: Payment) => <Badge color={statusColors[p.status] ?? 'gray'}>{p.status}</Badge>,
    },
    {
      key: 'date', header: 'Огноо',
      render: (p: Payment) => new Date(p.createdAt).toLocaleDateString('mn-MN'),
    },
  ];

  return (
    <>
      <PageHeader title="Монитор" description="Төлбөр ба захиалгын мэдээлэл" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <StatCard label="Нийт орлого" value={paidTotal.toLocaleString()} unit="MNT" />
        <StatCard label="Нийт төлбөр" value={payments.length} unit="гүйлгээ" />
        <StatCard label="Plan худалдаа" value={planSales} unit="захиалга" />
        <StatCard label="Хүлээгдэж буй" value={payments.filter(p => p.status === 'pending').length} unit="гүйлгээ" />
      </div>

      {/* Plans header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-800">Идэвхтэй планууд</h2>
        <Button size="sm" onClick={() => { setPlanForm(emptyPlanForm); setSaveError(''); setPlanModal(true); }}>
          <Plus className="h-4 w-4" /> Plan нэмэх
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        {plans.map(plan => (
          <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-navy text-lg">{plan.name}</span>
              <Badge color={planColors[plan.slug] ?? 'blue'}>{plan.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}</Badge>
            </div>
            <p className="text-2xl font-bold text-primary">{plan.priceAmount.toLocaleString()} ₮</p>
            <p className="text-xs text-gray-400 mb-3">{plan.durationDays} хоног</p>
            <ul className="space-y-1 mb-3">
              {(plan.features ?? []).map((f, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                  <span className="text-green-500 mt-0.5">✓</span> {f}
                </li>
              ))}
            </ul>
            {/* Usage limits */}
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-1">
              <LimitBadge label="🎙 Voice" value={plan.voiceMinutesLimit} unit="мин" />
              <LimitBadge label="🎧 STT" value={plan.sttMinutesLimit} unit="мин" />
              <LimitBadge label="📖 Толь" value={plan.dictionaryAiLimit} unit="үг" />
              <LimitBadge label="🧠 Memory" value={plan.memoryMbLimit} unit="MB" />
            </div>
          </div>
        ))}
      </div>

      {/* Payments */}
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Төлбөрийн жагсаалт</h2>
      <Table columns={paymentColumns} rows={payments} keyFn={(p) => p.id} empty="Төлбөр байхгүй" />

      {/* Plan create modal */}
      {planModal && (
        <Modal title="Шинэ план нэмэх" onClose={() => setPlanModal(false)}>
          <div className="space-y-4">
            <Input
              label="Нэр (жишээ: Premium)"
              value={planForm.name}
              onChange={(e) => handleNameChange(e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Slug (URL-д ашиглагдана)</label>
              <input
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none"
                value={planForm.slug}
                onChange={(e) => setPlanForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="premium"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Үнэ (₮)"
                type="number" min={0}
                value={planForm.priceAmount}
                onChange={(e) => setPlanForm(f => ({ ...f, priceAmount: e.target.value }))}
                placeholder="99000"
              />
              <Input
                label="Хоног"
                type="number" min={1}
                value={planForm.durationDays}
                onChange={(e) => setPlanForm(f => ({ ...f, durationDays: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                Онцлогууд <span className="text-gray-400 font-normal">(мөр тус бүр нэг онцлог)</span>
              </label>
              <textarea
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                rows={4}
                placeholder={"Бүх хичээл\nХязгааргүй AI мессеж\nVoice AI"}
                value={planForm.features}
                onChange={(e) => setPlanForm(f => ({ ...f, features: e.target.value }))}
              />
            </div>
            {/* Usage limits */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Сарын хязгаарлалт <span className="text-gray-400 font-normal">(хоосон = хязгааргүй)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="🎙 AI Voice (мин)"
                  type="number" min={0}
                  value={planForm.voiceMinutesLimit}
                  onChange={(e) => setPlanForm(f => ({ ...f, voiceMinutesLimit: e.target.value }))}
                  placeholder="25"
                />
                <Input
                  label="🎧 STT (мин)"
                  type="number" min={0}
                  value={planForm.sttMinutesLimit}
                  onChange={(e) => setPlanForm(f => ({ ...f, sttMinutesLimit: e.target.value }))}
                  placeholder="120"
                />
                <Input
                  label="📖 AI Толь (үг)"
                  type="number" min={0}
                  value={planForm.dictionaryAiLimit}
                  onChange={(e) => setPlanForm(f => ({ ...f, dictionaryAiLimit: e.target.value }))}
                  placeholder="300"
                />
                <Input
                  label="🧠 Memory (MB)"
                  type="number" min={0}
                  value={planForm.memoryMbLimit}
                  onChange={(e) => setPlanForm(f => ({ ...f, memoryMbLimit: e.target.value }))}
                  placeholder="100"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={planForm.isActive}
                onChange={(e) => setPlanForm(f => ({ ...f, isActive: e.target.checked }))}
                className="rounded"
              />
              Шууд идэвхтэй болгох
            </label>
            {saveError && <p className="text-sm text-red-500">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setPlanModal(false)}>Болих</Button>
              <Button onClick={savePlan} disabled={saving}>
                {saving ? 'Хадгалж байна...' : 'Нэмэх'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
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

function LimitBadge({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="text-xs text-gray-500">
      <span className="font-medium">{label}:</span>{' '}
      {value == null ? <span className="text-green-600">∞</span> : <span>{value} {unit}</span>}
    </div>
  );
}
