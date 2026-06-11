import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

interface Limits {
  dailyMessageLimit: number;
  dailyTokenLimit: number;
  maxContextMessages: number;
}

export default function SettingsPage() {
  const [limits, setLimits] = useState<Limits>({ dailyMessageLimit: 20, dailyTokenLimit: 10000, maxContextMessages: 10 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get<Limits>('/ai/limits').then(setLimits).catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setMsg('');
    try {
      await api.patch('/ai/limits', limits);
      setMsg('✅ Тохиргоо хадгалагдлаа');
    } catch {
      setMsg('❌ Хадгалахад алдаа гарлаа');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Тохиргоо" description="AI хязгаар болон системийн тохиргоо" />

      <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
        <h2 className="text-base font-semibold text-gray-800">AI хязгаар (хэрэглэгч бүрт/өдөрт)</h2>

        <Input
          label="Өдрийн мессежийн хязгаар"
          type="number" min={1}
          value={limits.dailyMessageLimit}
          onChange={(e) => setLimits({ ...limits, dailyMessageLimit: Number(e.target.value) })}
        />
        <Input
          label="Өдрийн токений хязгаар"
          type="number" min={100}
          value={limits.dailyTokenLimit}
          onChange={(e) => setLimits({ ...limits, dailyTokenLimit: Number(e.target.value) })}
        />
        <Input
          label="Харилцааны түүхийн максимум"
          type="number" min={1} max={50}
          value={limits.maxContextMessages}
          onChange={(e) => setLimits({ ...limits, maxContextMessages: Number(e.target.value) })}
        />

        {msg && <p className="text-sm">{msg}</p>}

        <Button onClick={save} disabled={saving}>
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </Button>
      </div>
    </>
  );
}
