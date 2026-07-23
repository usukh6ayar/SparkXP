import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { useAvatarPicker } from '../src/lib/useAvatarPicker';
import { ROLE_TKEY } from '../src/constants/roles';
import { useComingSoon } from '../src/lib/useLogoutConfirm';
import { t } from '../src/i18n';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { Avatar } from '../src/components/Avatar';
import { EditProfileModal } from '../src/components/EditProfileModal';
import { spacing, radius, elevation, tints, type AppColors } from '../src/theme/theme';
import { useColors } from '../src/settings/SettingsContext';
import { bounded } from '../src/theme/responsive';

/** One tappable / info row inside an account card. */
function Row({
  c, icon, tint, label, value, onPress, last,
}: {
  c: AppColors;
  icon: keyof typeof Ionicons.glyphMap;
  tint: { bg: string; fg: string };
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  const styles = makeStyles(c);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && onPress ? styles.pressed : null]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint.bg }]}>
        <Ionicons name={icon} size={18} color={tint.fg} />
      </View>
      <AppText variant="body" style={{ flex: 1 }}>{label}</AppText>
      {value ? <AppText variant="caption" color={c.textMuted} numberOfLines={1} style={styles.rowValue}>{value}</AppText> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={c.borderStrong} /> : null}
    </Pressable>
  );
}

/**
 * Account hub — opened from the Settings account card. One place to manage the
 * profile: change photo, edit profile info, and reach email / password. The
 * CEFR level is shown read-only (it's set by the placement test, not chosen).
 */
export default function AccountScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const router = useRouter();
  const { user } = useAuth();
  const { pickPhoto, busy } = useAvatarPicker();
  const soon = useComingSoon();
  const [editing, setEditing] = useState(false);

  const level = user?.level ? user.level.toUpperCase() : null;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('accountTitle')} back showBadges={false} />
      <ScrollView contentContainerStyle={[styles.container, bounded]} showsVerticalScrollIndicator={false}>
        {/* Avatar + identity */}
        <View style={styles.hero}>
          <Pressable style={styles.avatarWrap} onPress={pickPhoto} disabled={busy} accessibilityRole="button" accessibilityLabel={t('editAvatar')}>
            <View style={styles.avatarRing}>
              <Avatar avatarUrl={user?.avatarUrl} name={user?.fullName} size={92} />
            </View>
            <View style={styles.cameraBadge}>
              {busy ? <ActivityIndicator color={c.white} size="small" /> : <Ionicons name="camera" size={16} color={c.white} />}
            </View>
          </Pressable>

          <AppText variant="h2" center numberOfLines={1} style={styles.name}>{user?.fullName ?? '—'}</AppText>
          <View style={styles.metaRow}>
            <View style={styles.rolePill}>
              <AppText variant="label" color={c.primary}>
                {t(ROLE_TKEY[user?.role ?? 'student'] ?? 'roleStudent')}
              </AppText>
            </View>
            {level ? (
              <View style={[styles.rolePill, { backgroundColor: tints.green.bg }]}>
                <AppText variant="label" color={tints.green.fg}>{level}</AppText>
              </View>
            ) : null}
          </View>
        </View>

        {/* Profile */}
        <AppText variant="overline" color={c.textMuted} style={styles.sectionLabel}>{t('accountTitle').toUpperCase()}</AppText>
        <View style={styles.card}>
          <Row c={c} icon="person" tint={tints.blue} label={t('editProfile')} onPress={() => setEditing(true)} />
          <Row c={c} icon="ribbon" tint={tints.green} label={t('englishLevel')} value={level ?? '—'} last />
        </View>
        <AppText variant="caption" color={c.textMuted} style={styles.hint}>{t('levelFromTest')}</AppText>

        {/* Sign-in & security */}
        <AppText variant="overline" color={c.textMuted} style={styles.sectionLabel}>{t('security').toUpperCase()}</AppText>
        <View style={styles.card}>
          <Row c={c} icon="mail" tint={tints.coral} label={t('changeEmail')} value={user?.email ?? ''} onPress={soon} />
          <Row c={c} icon="lock-closed" tint={tints.purple} label={t('changePassword')} onPress={() => router.push('/change-password')} last />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      <EditProfileModal visible={editing} onClose={() => setEditing(false)} />
    </SafeAreaView>
  );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },

  hero: { alignItems: 'center', paddingVertical: spacing.lg },
  avatarWrap: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center' },
  avatarRing: {
    padding: 5, borderRadius: radius.full,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
    ...(elevation.sm as object),
  },
  cameraBadge: {
    position: 'absolute', right: 4, bottom: 4,
    width: 34, height: 34, borderRadius: radius.full, backgroundColor: c.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: c.background,
  },
  name: { marginTop: spacing.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  rolePill: {
    paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.full,
    backgroundColor: c.primarySoft,
  },

  sectionLabel: { marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: 4 },
  card: {
    backgroundColor: c.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.border },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowValue: { maxWidth: 150 },
  hint: { marginTop: spacing.sm, marginLeft: 4 },
  pressed: { opacity: 0.7 },
});
