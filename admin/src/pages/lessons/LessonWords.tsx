import { useState, useEffect, useCallback } from 'react';
import { Search, X, Plus } from 'lucide-react';
import { api } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';

interface BankWord {
  id: string;
  english: string;
  mongolian: string;
  level: string;
  status: string;
}

/**
 * Words attached to one lesson (`words.lesson_id`). The app lists these under
 * the lesson so a `vocabulary` lesson actually has vocabulary in it — until
 * now nothing in admin could set the link, so that section was always empty.
 *
 * Attaching = a bulk patch of `lessonId` on existing bank words (no copies), so
 * a word stays a single row that the Үгс page keeps owning.
 */
export function LessonWords({ lessonId }: { lessonId: string }) {
  const [attached, setAttached] = useState<BankWord[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BankWord[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const data = await api.get<{ items: BankWord[] }>(`/words?lessonId=${lessonId}&all=true&limit=200`);
    setAttached(data.items ?? []);
  }, [lessonId]);
  useEffect(() => { load(); }, [load]);

  async function search() {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true); setError('');
    try {
      const data = await api.get<{ items: BankWord[] }>(
        `/words?search=${encodeURIComponent(query.trim())}&all=true&limit=20`,
      );
      // Already-attached words aren't offered again.
      const has = new Set(attached.map((w) => w.id));
      setResults((data.items ?? []).filter((w) => !has.has(w.id)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Хайлт амжилтгүй');
    } finally { setSearching(false); }
  }

  /** `null` detaches the word from every lesson. */
  async function setLesson(id: string, value: string | null) {
    setBusy(true); setError('');
    try {
      await api.patch('/words/bulk', { ids: [id], changes: { lessonId: value } });
      setResults((r) => r.filter((w) => w.id !== id));
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Алдаа гарлаа');
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-800">Үгс (энэ хичээлийн үгсийн сан)</h3>
      <p className="mb-3 text-xs text-gray-400">
        Үгсийн сангаас хайж энэ хичээлд хавсаргана. Апп дээр хичээлийн доор "Хичээлийн үгс" болж гарна.
      </p>

      <div className="space-y-2">
        {attached.length === 0 && <p className="text-xs text-gray-400">Хавсаргасан үг алга.</p>}
        {attached.map((w) => (
          <div key={w.id} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <span className="flex-1 text-sm font-medium">{w.english}</span>
            <span className="flex-1 text-sm text-gray-500">{w.mongolian}</span>
            <Badge color="gray">{w.level?.toUpperCase()}</Badge>
            {w.status !== 'published' && <Badge color="yellow">{w.status}</Badge>}
            <button
              type="button"
              disabled={busy}
              onClick={() => setLesson(w.id, null)}
              title="Хичээлээс салгах"
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Үг хайх"
            value={query}
            placeholder="apple / алим"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } }}
          />
        </div>
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="mb-[2px] flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> Хайх
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {results.length > 0 && (
        <div className="mt-2 space-y-1 rounded-lg border border-gray-200 p-2">
          {results.map((w) => (
            <div key={w.id} className="flex items-center gap-2 px-1 py-1 text-sm">
              <span className="flex-1 font-medium">{w.english}</span>
              <span className="flex-1 text-gray-500">{w.mongolian}</span>
              <Badge color="gray">{w.level?.toUpperCase()}</Badge>
              <button
                type="button"
                disabled={busy}
                onClick={() => setLesson(w.id, lessonId)}
                className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" /> Нэмэх
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
