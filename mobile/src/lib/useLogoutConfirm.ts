import { Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useSettings } from '../settings/SettingsContext';

/** Returns a handler that shows a destructive "log out?" confirm alert. */
export function useLogoutConfirm() {
  const { logout } = useAuth();
  const { t } = useSettings();
  return () =>
    Alert.alert(t('logoutConfirm'), '', [
      { text: t('cancel') },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);
}

/** Returns a handler that shows a generic "coming soon" alert. */
export function useComingSoon() {
  const { t } = useSettings();
  return () => Alert.alert(t('comingSoon'), t('comingSoonBody'));
}
