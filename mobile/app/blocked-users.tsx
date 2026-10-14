import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { getBlockedUsers, unblockUser, type BlockedUser } from '../src/api/moderation';
import { t } from '../src/i18n';
import { TopBar } from '../src/components/TopBar';
import { PersonRow } from '../src/components/PersonRow';
import { EmptyState } from '../src/components/EmptyState';
import { ActionButton } from '../src/components/ActionButton';
import { alertError } from '../src/lib/alerts';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/** Тохиргоо → «Блоклосон хэрэглэгчид»: everyone this user blocked, with Unblock. */
export default function BlockedUsersScreen() {
  const c = useColors();
  const { token } = useAuth();
  const [people, setPeople] = useState<BlockedUser[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setPeople(await getBlockedUsers(token));
    } catch (e) {
      setPeople([]);
      alertError((e as Error).message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <TopBar title={t('blockedUsers')} back showBadges={false} />
      <ScrollView contentContainerStyle={[styles.container, bounded]}>
        {people === null ? (
          <ActivityIndicator color={c.primary} style={{ marginTop: spacing.xl }} />
        ) : people.length === 0 ? (
          <EmptyState icon="people" title={t('blockedUsers')} hint={t('blockedUsersEmpty')} />
        ) : (
          people.map((p) => (
            <PersonRow
              key={p.userId}
              name={p.fullName}
              username={p.username}
              avatarUrl={p.avatarUrl}
              style={StyleSheet.flatten([styles.row, { backgroundColor: c.surface, borderColor: c.border }])}
              right={
                <ActionButton
                  label={t('unblock')}
                  variant="secondary"
                  size="md"
                  action={() => unblockUser(p.userId, token!)}
                  onSuccess={() => setPeople((list) => list?.filter((x) => x.userId !== p.userId) ?? null)}
                />
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.sm },
  row: { gap: spacing.md, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md },
});
