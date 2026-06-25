import { useState, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Table } from '../../components/Table';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { FormActions } from '../../components/FormActions';
import { RowActions } from '../../components/RowActions';
import { formatDate } from '../../lib/utils';

interface Org {
  id: string;
  name: string;
  type: string;
  province: string | null;
  district: string | null;
  createdAt: string;
}

interface OrgForm {
  name: string;
  type: string;
  province: string;
  district: string;
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'Бүх төрөл' },
  { value: 'school', label: 'Сургууль' },
  { value: 'company', label: 'Компани' },
  { value: 'law_firm', label: 'Хуулийн фирм' },
];

const TYPE_CHIPS = [
  { value: 'school', label: 'Сургууль' },
  { value: 'company', label: 'Компани' },
  { value: 'law_firm', label: 'Хуулийн фирм' },
];

const TYPE_COLORS: Record<string, 'blue' | 'green' | 'yellow' | 'gray'> = {
  school: 'blue',
  company: 'green',
  law_firm: 'yellow',
};

const TYPE_LABELS: Record<string, string> = {
  school: 'Сургууль',
  company: 'Компани',
  law_firm: 'Хуулийн фирм',
};

const MN_PROVINCES = [
  '', 'Улаанбаатар', 'Архангай', 'Баян-Өлгий', 'Баянхонгор', 'Булган',
  'Говь-Алтай', 'Говьсүмбэр', 'Дархан-Уул', 'Дорноговь', 'Дорнод',
  'Дундговь', 'Завхан', 'Орхон', 'Өвөрхангай', 'Өмнөговь',
  'Сүхбаатар', 'Сэлэнгэ', 'Төв', 'Увс', 'Ховд', 'Хөвсгөл', 'Хэнтий',
];

const UB_DISTRICTS = [
  '', 'Багануур', 'Багахангай', 'Баянгол', 'Баянзүрх',
  'Налайх', 'Сонгинохайрхан', 'Сүхбаатар', 'Хан-Уул', 'Чингэлтэй',
];

const empty: OrgForm = { name: '', type: 'school', province: '', district: '' };

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<Org | null>(null);
  const [form, setForm] = useState<OrgForm>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const qs = typeFilter ? `?type=${typeFilter}&limit=100` : '?limit=100';
    const data = await api.get<{ items: Org[]; total: number }>(`/organizations${qs}`);
    setOrgs(data.items ?? []);
    setTotal(data.total ?? 0);
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setForm(empty); setEditing(null); setError(''); setModal('create'); }
  function openEdit(o: Org) {
    setForm({ name: o.name, type: o.type, province: o.province ?? '', district: o.district ?? '' });
    setEditing(o); setError(''); setModal('edit');
  }

  async function save() {
    if (!form.name.trim()) { setError('Байгууллагын нэр оруулна уу'); return; }
    if (!form.type.trim()) { setError('Байгууллагын төрөл оруулна уу'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        name: form.name,
        type: form.type,
        province: form.province || undefined,
        district: form.district || undefined,
      };
      if (modal === 'create') await api.post('/organizations', payload);
      else if (editing) await api.patch(`/organizations/${editing.id}`, payload);
      setModal(null); load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm('Энэ байгууллагыг устгах уу? Бүх холбоотой хэрэглэгчид холбоос нь тасрах болно.')) return;
    try {
      await api.delete(`/organizations/${id}`);
      load();
    } catch {
      alert('Устгахад алдаа гарлаа');
    }
  }

  const provinceOptions = MN_PROVINCES.map(p => ({ value: p, label: p || 'Аймаг/хот сонгох...' }));
  const districtOptions = UB_DISTRICTS.map(d => ({ value: d, label: d || 'Дүүрэг сонгох...' }));

  const columns = [
    {
      key: 'name', header: 'Нэр',
      render: (o: Org) => <span className="font-medium text-gray-900">{o.name}</span>,
    },
    {
      key: 'type', header: 'Төрөл',
      render: (o: Org) => (
        <Badge color={TYPE_COLORS[o.type] ?? 'gray'}>{TYPE_LABELS[o.type] ?? o.type}</Badge>
      ),
    },
    {
      key: 'province', header: 'Аймаг/Хот',
      render: (o: Org) => o.province ?? <span className="text-gray-300">—</span>,
    },
    {
      key: 'district', header: 'Дүүрэг',
      render: (o: Org) => o.district ?? <span className="text-gray-300">—</span>,
    },
    {
      key: 'date', header: 'Огноо',
      render: (o: Org) => (
        <span className="text-xs text-gray-400">{formatDate(o.createdAt)}</span>
      ),
    },
    {
      key: 'actions', header: '',
      render: (o: Org) => (
        <div className="flex gap-2 justify-end">
          <RowActions onEdit={() => openEdit(o)} onDelete={() => remove(o.id)} />
        </div>
      ),
      className: 'text-right',
    },
  ];

  return (
    <>
      <PageHeader
        title="Байгууллагууд"
        description={`Нийт: ${total} байгууллага`}
        action={
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Байгууллага нэмэх</Button>
        }
      />

      <div className="mb-4">
        <Select
          options={TYPE_FILTER_OPTIONS}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <Table columns={columns} rows={orgs} keyFn={(o) => o.id} empty="Байгууллага байхгүй байна" />

      {(modal === 'create' || modal === 'edit') && (
        <Modal
          title={modal === 'create' ? 'Байгууллага нэмэх' : 'Байгууллага засах'}
          onClose={() => setModal(null)}
        >
          <div className="space-y-4">
            <Input
              label="Байгууллагын нэр"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="СДС Хуулийн фирм"
            />

            {/* Type chooser — chips + free-text fallback */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Төрөл</label>
              <div className="flex gap-2 flex-wrap">
                {TYPE_CHIPS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm({ ...form, type: opt.value })}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      form.type === opt.value
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <input
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                placeholder="Өөр төрөл (жишээ: university, ngo...)"
              />
            </div>

            <Select
              label="Аймаг / хот"
              options={provinceOptions}
              value={form.province}
              onChange={(e) => setForm({ ...form, province: e.target.value, district: '' })}
            />

            {form.province === 'Улаанбаатар' && (
              <Select
                label="Дүүрэг"
                options={districtOptions}
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
              />
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <FormActions onCancel={() => setModal(null)} onSave={save} saving={saving} />
          </div>
        </Modal>
      )}
    </>
  );
}
