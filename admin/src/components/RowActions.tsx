import { Pencil, Trash2 } from 'lucide-react';
import { Button } from './Button';

interface Props {
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * The standard edit + delete ghost buttons used in table action columns.
 * Renders just the buttons (no wrapper) so it drops into an existing flex row.
 */
export function RowActions({ onEdit, onDelete }: Props) {
  return (
    <>
      {onEdit && (
        <Button variant="ghost" size="sm" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 text-red-500" /></Button>
      )}
    </>
  );
}
