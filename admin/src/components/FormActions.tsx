import { Button } from './Button';

interface Props {
  onCancel: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  savingLabel?: React.ReactNode;
  cancelLabel?: string;
  /** Container classes — override for footers with a top border / extra padding. */
  className?: string;
}

/**
 * Shared modal footer: a "cancel" + a "save" button with a busy state.
 * Replaces the same hand-written footer that appeared in every CRUD modal.
 */
export function FormActions({
  onCancel,
  onSave,
  saving = false,
  saveLabel = 'Хадгалах',
  savingLabel = 'Хадгалж байна...',
  cancelLabel = 'Болих',
  className = 'flex justify-end gap-2 pt-2',
}: Props) {
  return (
    <div className={className}>
      <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
      <Button onClick={onSave} disabled={saving}>{saving ? savingLabel : saveLabel}</Button>
    </div>
  );
}
