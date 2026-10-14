import { Alert } from 'react-native';
import { blockUser, reportUser, type ReportReason } from '../api/moderation';
import { t, tf } from '../i18n';
import { alertError, confirm } from './alerts';

/**
 * Report / block another user — opened by tapping their leaderboard row.
 * Profile photos and names are user-generated content, so App Store guideline
 * 1.2 requires both actions to be reachable wherever other users appear.
 */
export function openUserActions(
  person: { userId: string; name: string },
  token: string,
  onBlocked: () => void,
): void {
  Alert.alert(person.name, undefined, [
    { text: t('reportUser'), onPress: () => pickReason(person.userId, token) },
    { text: t('blockUser'), style: 'destructive', onPress: () => askBlock(person, token, onBlocked) },
    { text: t('cancel'), style: 'cancel' },
  ]);
}

function pickReason(userId: string, token: string) {
  const send = (reason: ReportReason) =>
    reportUser(userId, reason, token)
      .then(() => Alert.alert(t('reportSent')))
      .catch((e: Error) => alertError(e.message));
  Alert.alert(t('reportReasonTitle'), undefined, [
    { text: t('reportReasonPhoto'), onPress: () => send('photo') },
    { text: t('reportReasonName'), onPress: () => send('name') },
    { text: t('reportReasonOther'), onPress: () => send('other') },
    { text: t('cancel'), style: 'cancel' },
  ]);
}

function askBlock(person: { userId: string; name: string }, token: string, onBlocked: () => void) {
  confirm({
    title: tf('blockConfirmTitle', { name: person.name }),
    message: t('blockConfirmBody'),
    confirmLabel: t('blockUser'),
    destructive: true,
    onConfirm: () =>
      blockUser(person.userId, token)
        .then(onBlocked)
        .catch((e: Error) => alertError(e.message)),
  });
}
