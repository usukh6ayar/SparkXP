import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, ArrowRight } from 'lucide-react';
import { api } from '../../api/client';

interface Word {
  id: string;
  english: string;
  mongolian: string;
}

/**
 * Speaking (pronunciation) exercise — admin view.
 *
 * The app's speaking drill (`app/speaking.tsx`) reads straight from the Үгс word
 * bank, so there is nothing separate to author here: whatever words live in Үгс
 * are exactly what the learner is asked to pronounce. This panel makes that
 * explicit — it previews those words and links to the Үгс page to manage them.
 */
export function SpeakingPanel() {
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: Word[]; total: number }>('/words?limit=100')
      .then((r) => {
        setWords(r.items);
        setTotal(r.total);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-wrap items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2">
          <Mic className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900">Ярих (дуудлага) дасгал</h3>
          <p className="text-sm text-gray-500">
            Сурагч үгийг чангаар дуудаж, апп нь ярианы таних (STT)-аар шалгана. Энэ дасгал{' '}
            <b>Үгс</b> банкийг ашигладаг — доорх {total} үг апп дээр гарна. Үг нэмэх, засах, устгах
            бол <b>Үгс</b> цэс рүү орно уу.
          </p>
        </div>
        <Link
          to="/words"
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Үгс цэс <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-400">Ачаалж байна…</p>
      ) : words.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">
          Үг алга — «Үгс» цэсээс нэмбэл энд болон апп дээр гарна.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {words.map((w) => (
            <div key={w.id} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div className="truncate font-medium text-gray-800">{w.english}</div>
              <div className="truncate text-xs text-gray-500">{w.mongolian}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
