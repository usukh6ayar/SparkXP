import { Button, type ButtonProps } from './Button';
import { confirm as confirmDialog } from '../lib/alerts';
import { useAsyncAction } from '../lib/useAsyncAction';

interface Props<T> extends Omit<ButtonProps, 'onPress' | 'loading'> {
  /** The backend call. Its spinner, error and double-tap guard are handled here. */
  action: () => Promise<T>;
  onSuccess?: (result: T) => void;
  /** Show the failure inline (pass `setError`) instead of the default alert. */
  onError?: (message: string, error: unknown) => void;
  /** success/error buzz on finish. Default on. */
  haptic?: boolean;
  /** Ask before running — for destructive calls (delete, spend Sparks). */
  confirm?: {
    title: string;
    message?: string;
    confirmLabel?: string;
    destructive?: boolean;
  };
}

/**
 * A `Button` that calls the backend.
 *
 * The screen supplies only the call itself; the spinner, the disable-while-
 * running, the double-tap guard, the haptic and the error message all come from
 * `useAsyncAction` so every such button behaves identically. Use it instead of
 * `<Button>` + a hand-written `busy` state whenever the press hits the API.
 *
 *   <ActionButton
 *     label={t('joinBtn')}
 *     action={() => requestJoinClass(code, token)}
 *     onSuccess={(res) => setPending(res.className)}
 *     onError={setError}
 *   />
 */
export function ActionButton<T>({
  action,
  onSuccess,
  onError,
  haptic,
  confirm,
  ...button
}: Props<T>) {
  const { busy, run } = useAsyncAction(action, { onSuccess, onError, haptic });

  return (
    <Button
      {...button}
      loading={busy}
      onPress={confirm ? () => confirmDialog({ ...confirm, onConfirm: run }) : run}
    />
  );
}
