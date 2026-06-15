import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/words');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Нэвтрэхэд алдаа гарлаа');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy shadow-lg">
            <Zap className="h-7 w-7 text-amber" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-navy">SparkXP Admin</h1>
            <p className="mt-1 text-sm text-gray-500">Зөвхөн admin/super_admin</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-8 shadow-sm border border-gray-200 space-y-4"
        >
          <Input
            label="Имэйл"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            autoFocus
          />
          <Input
            label="Нууц үг"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full justify-center">
            {loading ? 'Нэвтэрч байна...' : 'Нэвтрэх'}
          </Button>
        </form>
      </div>
    </div>
  );
}
