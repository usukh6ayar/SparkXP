import type { ReactNode } from 'react';

/** Нимгэн явцын зураас. Модал доторх богино ажилд ганцаараа ч хэрэглэнэ. */
export function ProgressBar({ pct, tone = 'blue' }: { pct: number; tone?: 'blue' | 'primary' }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full ${tone === 'blue' ? 'bg-blue-100' : 'bg-gray-100'}`}>
      <div
        className={`h-full transition-all duration-500 ${tone === 'blue' ? 'bg-blue-500' : 'bg-primary'}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export interface JobFailure {
  /** Мөрийг таних нэр (үг · хэлц · гарчиг). */
  key: string;
  message: string;
}

interface Props {
  /** Дээд мөрийн тайлбар — ж: "⏳ AI боловсруулж байна". */
  label: ReactNode;
  processed: number;
  total: number;
  /** Явцын мөрийн ард нэмэх тоонууд (амжилттай / давхардал г.м.). */
  stats?: ReactNode;
  failures?: JobFailure[];
  /** Ажил ажиллаж байхад "Зогсоох" товч. */
  onCancel?: () => void;
  canceling?: boolean;
  /** Дууссаны дараа "Хаах" товч. */
  onClose?: () => void;
  done?: boolean;
  note?: ReactNode;
}

/**
 * Background AI ажлын **дундын** явцын самбар — Үгс, Хэлц, AI-аар үүсгэх
 * гурвуулан нэг хэлбэртэй байхын тулд (CODING_RULES §0.2). Өмнө нь хуудас бүр
 * ижилхэн 40 мөр JSX-ийг хуулж бичсэн байв.
 *
 * Алдааг **үргэлж** харуулна: `failures` дотор мөр бүрийн шалтгаан задарна —
 * ингэснээр "яагаад 40-өөс 37 л орсон бэ?" гэдэг нь тодорхой болно.
 */
export function JobProgress({
  label, processed, total, stats, failures = [],
  onCancel, canceling, onClose, done, note,
}: Props) {
  const pct = total ? Math.round((processed / total) * 100) : 0;
  return (
    <div className="mb-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <div className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {done ? (
          onClose && <button onClick={onClose} className="text-xs text-blue-500 hover:underline">Хаах</button>
        ) : (
          onCancel && (
            <button
              onClick={onCancel}
              disabled={canceling}
              className="rounded-md bg-red-500 px-3 py-1 text-xs font-medium text-white hover:bg-red-600 disabled:opacity-50"
            >
              {canceling ? 'Зогсоож байна…' : 'Зогсоох'}
            </button>
          )
        )}
      </div>

      <ProgressBar pct={pct} />

      <p className="text-xs">
        {processed}/{total} ({pct}%){stats}
        {failures.length > 0 && <> · алдаа {failures.length}</>}
      </p>

      {failures.length > 0 && (
        <details className="text-xs text-red-600">
          <summary className="cursor-pointer">{failures.length} амжилтгүй — дэлгэрэнгүй</summary>
          <ul className="mt-1 list-disc pl-4">
            {failures.slice(0, 20).map((f) => (
              <li key={f.key}>{f.key}: {f.message}</li>
            ))}
          </ul>
        </details>
      )}

      {note && <p className="text-xs text-blue-600">{note}</p>}
    </div>
  );
}
