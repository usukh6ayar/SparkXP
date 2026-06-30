import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface Props {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}

/**
 * Shared list pagination: "Нийт N" + prev / "page / pages" / next.
 * Renders nothing when everything fits on one page.
 */
export function Pagination({ page, total, limit, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-sm text-gray-500">Нийт {total}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> Өмнөх
        </Button>
        <span className="text-sm text-gray-600">{page} / {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Дараах <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
