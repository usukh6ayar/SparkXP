import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';

interface Limits {
  dailyMessageLimit: number;
  dailyTokenLimit: number;
  maxContextMessages: number;
  // AI Buddy voice (runtime-tunable)
  sttMinConfidence: number;
  dailyVoiceTurnLimit: number;
  maxReplyChars: number;
}

export default function SettingsPage() {
  const [limits, setLimits] = useState<Limits>({
    dailyMessageLimit: 20, dailyTokenLimit: 10000, maxContextMessages: 10,
    sttMinConfidence: 0.4, dailyVoiceTurnLimit: 60, maxReplyChars: 280,
  });
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

        <div className="border-t border-gray-100 pt-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">AI Buddy дуут яриа</h2>
          <div className="space-y-5">
            <Input
              label="STT итгэлцлийн доод хязгаар (0–1)"
              type="number" min={0} max={1} step={0.05}
              value={limits.sttMinConfidence}
              onChange={(e) => setLimits({ ...limits, sttMinConfidence: Number(e.target.value) })}
            />
            <Input
              label="Өдрийн дуут turn-ийн хязгаар"
              type="number" min={1}
              value={limits.dailyVoiceTurnLimit}
              onChange={(e) => setLimits({ ...limits, dailyVoiceTurnLimit: Number(e.target.value) })}
            />
            <Input
              label="Хариултын дээд урт (тэмдэгт ≈15сек)"
              type="number" min={80} max={600}
              value={limits.maxReplyChars}
              onChange={(e) => setLimits({ ...limits, maxReplyChars: Number(e.target.value) })}
            />
          </div>
        </div>

        {msg && <p className="text-sm">{msg}</p>}

        <Button onClick={save} disabled={saving}>
          {saving ? 'Хадгалж байна...' : 'Хадгалах'}
        </Button>
      </div>
    </>
  );
}
