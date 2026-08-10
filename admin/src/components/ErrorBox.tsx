import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  /** Хоосон/undefined бол юу ч харагдахгүй — `{error && …}` бичих шаардлагагүй. */
  message?: string;
  /** Өгвөл "Дахин оролдох" товч гарна. */
  onRetry?: () => void;
  retryLabel?: string;
}

/**
 * Улаан алдааны хайрцаг — дүрс + мессеж + (заавал биш) дахин оролдох товч.
 * Өмнө нь дэлгэц бүр `<p className="text-sm text-red-500">` гэж өөрөө бичдэг
 * байсан тул алдаа анзаарагдахгүй өнгөрдөг байв.
 */
export function ErrorBox({ message, onRetry, retryLabel = 'Дахин оролдох' }: Props) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1 whitespace-pre-wrap">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="flex shrink-0 items-center gap-1 font-medium hover:underline">
          <RotateCw className="h-3.5 w-3.5" /> {retryLabel}
        </button>
      )}
    </div>
  );
}
