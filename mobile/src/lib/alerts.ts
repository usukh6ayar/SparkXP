import { Alert } from 'react-native';
import { t } from '../i18n';

/** Single-button alert; title defaults to "Алдаа" / "Error". */
export function alertError(message: string, title?: string): void {
  Alert.alert(title ?? t('error'), message);
}

/** Two-button confirm dialog (cancel + confirm). */
export function confirm(opts: {
  title: string;
  message?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}): void {
  Alert.alert(opts.title, opts.message, [
    { text: t('cancel') },
    {
      text: opts.confirmLabel ?? t('continue'),
      style: opts.destructive ? 'destructive' : undefined,
      onPress: opts.onConfirm,
    },
  ]);
}
