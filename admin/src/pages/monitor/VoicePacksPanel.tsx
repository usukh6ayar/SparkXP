import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { FormActions } from '../../components/FormActions';

interface VoicePack {
  id: string; name: string; slug: string; priceAmount: number;
  voiceMinutes: number; sttMinutes: number; isActive: boolean;
}
type Form = { name: string; slug: string; priceAmount: string; voiceMinutes: string; sttMinutes: string; isActive: boolean };
const emptyForm: Form = { name: '', slug: '', priceAmount: '', voiceMinutes: '', sttMinutes: '', isActive: true };

/**
 * Pay-as-you-go AI Buddy minutes: packs sold on the website. Used only after
 * the monthly plan limit runs out, never expire. Active packs show on the
 * website's pricing section and checkout.
 */
export function VoicePacksPanel() {
  const [packs, setPacks] = useState<VoicePack[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  /** Pack being edited; null = creating a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<VoicePack[]>('/payments/packs').then(setPacks).catch(() => {});
  }, []);
  useEffect(load, [load]);

  function edit(p: VoicePack | null) {
    setEditingId(p?.id ?? null);
    setForm(p ? {
      name: p.name, slug: p.slug, priceAmount: String(p.priceAmount),
      voiceMinutes: String(p.voiceMinutes), sttMinutes: String(p.sttMinutes), isActive: p.isActive,
    } : emptyForm);
    setError('');
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.slug.trim()) { setError('Нэр болон slug оруулна уу'); return; }
    if (Number(form.priceAmount) < 100) { setError('Үнэ хамгийн багадаа 100 ₮'); return; }
    setSaving(true); setError('');
    try {
      const body = {
        name: form.name,
        priceAmount: Number(form.priceAmount),
        voiceMinutes: Number(form.voiceMinutes) || 0,
        sttMinutes: Number(form.sttMinutes) || 0,
        isActive: form.isActive,
      };
      // The slug never changes after creation (the website links by it).
      if (editingId) await api.patch(`/payments/packs/${editingId}`, body);
      else await api.post('/payments/packs', { ...body, slug: form.slug });
      setOpen(false);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setSaving(false); }
  }

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-gray-800">Нэмэлт минут (pay as you go)</h2>
        <Button size="sm" onClick={() => edit(null)}>
          <Plus className="h-4 w-4" /> Багц нэмэх
        </Button>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Сарын хязгаар дууссаны дараа хэрэглэгдэнэ, хугацаа дуусахгүй. Вэбээр зарагдана.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
        {packs.length === 0 && (
          <p className="text-sm text-gray-400">Багц алга — «Багц нэмэх»-ээр үүсгэнэ үү.</p>
        )}
        {packs.map(p => (
          <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-navy text-lg">{p.name}</span>
              <Badge color={p.isActive ? 'green' : 'gray'}>{p.isActive ? 'Идэвхтэй' : 'Идэвхгүй'}</Badge>
            </div>
            <p className="text-2xl font-bold text-primary">{p.priceAmount.toLocaleString()} ₮</p>
            <p className="text-xs text-gray-500 mt-2">🎙 Spark ярих: {p.voiceMinutes} мин · 🎧 Яриа таних: {p.sttMinutes} мин</p>
            <div className="flex items-center justify-between mt-3">
              <p className="text-xs text-gray-400">{p.slug}</p>
              <button type="button" onClick={() => edit(p)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                <Pencil className="h-3.5 w-3.5" /> Засах
              </button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal title={editingId ? 'Минутын багц засах' : 'Минутын багц нэмэх'} onClose={() => setOpen(false)}>
          <div className="space-y-4">
            <Input label="Нэр (жишээ: 30 минут)" value={form.name} onChange={set('name')} />
            <Input label="Slug (вэбийн холбоост)" value={form.slug} onChange={set('slug')}
              disabled={editingId !== null} placeholder="min30" />
            <Input label="Үнэ (₮, ≥ 100)" type="number" min={100} value={form.priceAmount} onChange={set('priceAmount')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="🎙 Spark ярих (мин)" type="number" min={0} value={form.voiceMinutes} onChange={set('voiceMinutes')} />
              <Input label="🎧 Яриа таних (мин)" type="number" min={0} value={form.sttMinutes} onChange={set('sttMinutes')} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isActive} className="rounded"
                onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              Идэвхтэй — вэб дээр зарагдана
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <FormActions onCancel={() => setOpen(false)} onSave={save} saving={saving}
              saveLabel={editingId ? 'Хадгалах' : 'Нэмэх'} />
          </div>
        </Modal>
      )}
    </>
  );
}
