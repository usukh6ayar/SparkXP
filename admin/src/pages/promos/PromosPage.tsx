import { useCallback, useEffect, useState } from 'react';
import { History, Plus, Sparkles } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Select } from '../../components/Select';
import { RowActions } from '../../components/RowActions';
import { formatDate } from '../../lib/utils';
import { HistoryModal, InfluencerModal, PromoFormModal } from './PromoModals';
import { isLive, valueLabel, type Plan, type Promo } from './types';

const AUDIENCE_FILTER = [
  { value: '', label: 'Бүгд' },
  { value: 'general', label: 'Ерөнхий промо' },
  { value: 'influencer', label: 'Influencer' },
];

/**
 * Promo codes + influencer access (tasks #5, #6).
 *
 * Free-access codes work end to end today; discount codes are stored and
 * priced (`POST /promos/quote`) but only apply once payments are switched on.
 */
export default function PromosPage() {
  const [promos, setPromos] = useState<Promo[] | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [audience, setAudience] = useState('');
  const [modal, setModal] = useState<null | { kind: 'form'; editing: Promo | null } | { kind: 'influencer' } | { kind: 'history'; promo: Promo }>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const qs = audience ? `?audience=${audience}` : '';
    setPromos(await api.get<Promo[]>(`/admin/promos${qs}`));
  }, [audience]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { api.get<Plan[]>('/payments/plans').then(setPlans).catch(() => setPlans([])); }, []);

  function saved(msg = 'Хадгаллаа') {
    setModal(null);
    setNotice(msg);
    void load();
  }

  async function toggle(p: Promo) {
    await api.patch(`/admin/promos/${p.id}`, { isActive: !p.isActive });
    void load();
  }

  const columns = [
    {
      key: 'code', header: 'Код',
      render: (p: Promo) => (
        <div>
          <div className="font-mono font-semibold text-gray-900">{p.code}</div>
          <div className="text-xs text-gray-400">{p.name}</div>
        </div>
      ),
    },
    {
      key: 'kind', header: 'Юу өгөх',
      render: (p: Promo) => (
        <div>
          <div>{valueLabel(p)}</div>
          <div className="text-xs text-gray-400">{p.plan?.name ?? (p.kind === 'free_access' ? '—' : 'Бүх багц')}</div>
        </div>
      ),
    },
    {
      key: 'who', header: 'Хэнд',
      render: (p: Promo) => (
        <div className="flex flex-col gap-1">
          {p.audience === 'influencer' && <Badge color="yellow">Influencer</Badge>}
          {p.assignedUser && <span className="text-xs text-gray-500">{p.assignedUser.email}</span>}
        </div>
      ),
    },
    {
      key: 'dates', header: 'Хугацаа',
      render: (p: Promo) => (
        <span className="text-xs text-gray-500">
          {p.validFrom ? formatDate(p.validFrom) : '…'} — {p.validUntil ? formatDate(p.validUntil) : '…'}
        </span>
      ),
    },
    {
      key: 'used', header: 'Ашигласан',
      render: (p: Promo) => <span>{p.usedCount} / {p.usageLimit ?? '∞'}</span>,
    },
    {
      key: 'status', header: 'Төлөв',
      render: (p: Promo) => (
        <button type="button" onClick={() => void toggle(p)} title="Идэвхтэй/идэвхгүй болгох">
          {isLive(p) ? <Badge color="green">Идэвхтэй</Badge> : <Badge color="gray">{p.isActive ? 'Хугацаа/эрх дууссан' : 'Идэвхгүй'}</Badge>}
        </button>
      ),
    },
    {
      key: 'actions', header: '', className: 'text-right',
      render: (p: Promo) => (
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setModal({ kind: 'history', promo: p })} title="Ашигласан түүх">
            <History className="h-4 w-4" />
          </Button>
          <RowActions onEdit={() => setModal({ kind: 'form', editing: p })} />
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Промо код"
        description={`Нийт: ${promos?.length ?? 0} код · Идэвхтэй: ${promos?.filter((p) => isLive(p)).length ?? 0}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setModal({ kind: 'influencer' })}>
              <Sparkles className="h-4 w-4" /> Influencer эрх
            </Button>
            <Button onClick={() => setModal({ kind: 'form', editing: null })}>
              <Plus className="h-4 w-4" /> Промо код
            </Button>
          </div>
        }
      />

      {notice && (
        <p className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>
      )}

      <div className="mb-4">
        <Select options={AUDIENCE_FILTER} value={audience} onChange={(e) => setAudience(e.target.value)} className="w-48" />
      </div>

      <Table columns={columns} rows={promos ?? []} keyFn={(p) => p.id} loading={promos === null} empty="Промо код байхгүй. «Промо код» товчоор эхнийхээ үүсгэнэ үү." />

      {modal?.kind === 'form' && (
        <PromoFormModal plans={plans} editing={modal.editing} onClose={() => setModal(null)} onSaved={() => saved()} />
      )}
      {modal?.kind === 'influencer' && (
        <InfluencerModal plans={plans} onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal?.kind === 'history' && <HistoryModal promo={modal.promo} onClose={() => setModal(null)} />}
    </>
  );
}
