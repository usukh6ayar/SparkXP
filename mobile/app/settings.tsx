import { useCallback, useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/auth/AuthContext';
import { useSettings } from '../src/settings/SettingsContext';
import { AppText } from '../src/components/Text';
import { resolveAvatar } from '../src/lib/avatar';
import { colors, spacing, radius, tints, type PremiumPalette } from '../src/theme/theme';
import type { Lang } from '../src/i18n';

type IconName = keyof typeof Ionicons.glyphMap;
type Tint = { bg: string; fg: string };

const avatarImg = require('../assets/buddy-menu.png');
const APP_VERSION = '1.0.0';

const ROLE_LABEL: Record<string, string> = {
  student: 'Сурагч', teacher: 'Багш', admin: 'Админ', super_admin: 'Супер админ',
};

// Locally-persisted switch prefs (UI-only — nothing else reacts to them yet).
const KEYS = { notifications: 'settings.notifications', sound: 'settings.sound', haptics: 'settings.haptics' };

type Option<T> = { value: T; label: string; icon: IconName };

/** A grouped card that draws thin dividers between its child rows. */
function Card({ p, children }: { p: PremiumPalette; children: React.ReactNode }) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? <View style={[styles.divider, { backgroundColor: p.divider }]} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

/** One settings row: tinted icon + label (+ optional subtitle) + right control. */
function Row({
  p, icon, tint, label, right, onPress, danger,
}: {
  p: PremiumPalette; icon: IconName; tint: Tint; label: string;
  right?: React.ReactNode; onPress?: () => void; danger?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.dangerSoft : tint.bg }]}>
        <Ionicons name={icon} size={19} color={danger ? colors.danger : tint.fg} />
      </View>
      <AppText variant="body" color={danger ? colors.danger : p.text} style={{ flex: 1 }}>{label}</AppText>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={p.textMuted} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>{body}</Pressable>;
}

/** A two-option segmented toggle (icon + label per side). */
function SegToggle<T extends string>({
  p, options, value, onChange,
}: {
  p: PremiumPalette; options: [Option<T>, Option<T>]; value: T; onChange: (v: T) => void;
}) {
  return (
    <View style={[styles.toggle, { backgroundColor: p.track }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.toggleItem, active && { backgroundColor: p.primary }]}
          >
            <Ionicons name={opt.icon} size={17} color={active ? colors.white : p.textSecondary} />
            <AppText variant="bodyStrong" color={active ? colors.white : p.textSecondary}>{opt.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { theme, lang, palette: p, setTheme, setLang, t } = useSettings();

  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);

  // Restore switch prefs + keep the status bar readable for the active theme.
  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(KEYS.notifications).then((v) => { if (v != null) setNotifications(v === '1'); });
      AsyncStorage.getItem(KEYS.sound).then((v) => { if (v != null) setSound(v === '1'); });
      AsyncStorage.getItem(KEYS.haptics).then((v) => { if (v != null) setHaptics(v === '1'); });
      setStatusBarStyle(theme === 'dark' ? 'light' : 'dark');
      return () => setStatusBarStyle('dark');
    }, [theme]),
  );

  const toggle = (key: string, set: (v: boolean) => void) => (v: boolean) => {
    set(v); AsyncStorage.setItem(key, v ? '1' : '0');
  };

  const soon = () => Alert.alert(t('comingSoon'), t('comingSoonBody'));
  const confirmLogout = () =>
    Alert.alert(t('logoutConfirm'), '', [
      { text: t('cancel') },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);

  const Switcher = ({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) => (
    <Switch value={value} onValueChange={onValueChange}
      trackColor={{ false: p.track, true: p.primary }} thumbColor={colors.white} ios_backgroundColor={p.track} />
  );

  const SectionLabel = ({ children }: { children: string }) => (
    <AppText variant="overline" color={p.textMuted} style={styles.sectionLabel}>{children}</AppText>
  );

  return (
    <View style={[styles.root, { backgroundColor: p.bgFlat }]}>
      <LinearGradient colors={p.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={p.text} />
          </Pressable>
          <AppText variant="h2" color={p.text}>{t('settings')}</AppText>
          <View style={styles.backBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Account mini-card */}
          <Pressable onPress={() => router.push('/avatar')}
            style={({ pressed }) => [styles.account, { backgroundColor: p.card, borderColor: p.cardBorder }, pressed && styles.pressed]}>
            <Image source={resolveAvatar(user?.avatarUrl) ?? avatarImg} style={[styles.accountAvatar, { backgroundColor: p.track }]} resizeMode="cover" />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" color={p.text} numberOfLines={1}>{user?.fullName ?? '—'}</AppText>
              <AppText variant="caption" color={p.textMuted}>
                {ROLE_LABEL[user?.role ?? 'student'] ?? 'Сурагч'}{user?.email ? ` · ${user.email}` : ''}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
          </Pressable>

          {/* Appearance + Language */}
          <SectionLabel>{t('settings').toUpperCase()}</SectionLabel>
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
            <View style={styles.prefBlock}>
              <View style={styles.prefHead}>
                <Ionicons name="color-palette" size={18} color={tints.purple.fg} />
                <AppText variant="body" color={p.text}>{t('appearance')}</AppText>
              </View>
              <SegToggle p={p} value={theme} onChange={setTheme}
                options={[
                  { value: 'dark', label: t('dark'), icon: 'moon' },
                  { value: 'light', label: t('light'), icon: 'sunny' },
                ]} />
            </View>
            <View style={[styles.divider, { backgroundColor: p.divider }]} />
            <View style={styles.prefBlock}>
              <View style={styles.prefHead}>
                <Ionicons name="language" size={18} color={tints.blue.fg} />
                <AppText variant="body" color={p.text}>{t('languageLabel')}</AppText>
              </View>
              <SegToggle<Lang> p={p} value={lang} onChange={setLang}
                options={[
                  { value: 'mn', label: t('mongolian'), icon: 'flag' },
                  { value: 'en', label: t('english'), icon: 'flag-outline' },
                ]} />
            </View>
          </View>

          {/* Notifications & sound */}
          <SectionLabel>{t('notificationsSound').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="notifications" tint={tints.coral} label={t('notifications')}
              right={<Switcher value={notifications} onValueChange={toggle(KEYS.notifications, setNotifications)} />} />
            <Row p={p} icon="volume-high" tint={tints.amber} label={t('sound')}
              right={<Switcher value={sound} onValueChange={toggle(KEYS.sound, setSound)} />} />
            <Row p={p} icon="phone-portrait" tint={tints.teal} label={t('haptics')}
              right={<Switcher value={haptics} onValueChange={toggle(KEYS.haptics, setHaptics)} />} />
          </Card>

          {/* Account */}
          <SectionLabel>{t('account').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="person" tint={tints.blue} label={t('editProfile')} onPress={() => router.back()} />
            <Row p={p} icon="lock-closed" tint={tints.purple} label={t('changePassword')} onPress={soon} />
            <Row p={p} icon="shield-checkmark" tint={tints.green} label={t('privacy')} onPress={soon} />
          </Card>

          {/* Support */}
          <SectionLabel>{t('support').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="help-circle" tint={tints.blue} label={t('helpFaq')} onPress={soon} />
            <Row p={p} icon="chatbubble-ellipses" tint={tints.pink} label={t('sendFeedback')} onPress={soon} />
            <Row p={p} icon="star" tint={tints.amber} label={t('rateApp')} onPress={soon} />
            <Row p={p} icon="share-social" tint={tints.teal} label={t('shareApp')} onPress={soon} />
          </Card>

          {/* Legal */}
          <SectionLabel>{t('legal').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="document-text" tint={tints.purple} label={t('terms')} onPress={soon} />
            <Row p={p} icon="shield" tint={tints.green} label={t('privacyPolicy')} onPress={soon} />
          </Card>

          {/* Logout */}
          <View style={{ marginTop: spacing.lg }}>
            <Card p={p}>
              <Row p={p} icon="log-out-outline" tint={tints.coral} label={t('logout')} danger onPress={confirmLogout} />
            </Card>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <AppText variant="caption" color={p.textMuted}>SparkXP v{APP_VERSION}</AppText>
            <AppText variant="caption" color={p.textMuted}>© Hustle Hive LLC</AppText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  account: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.md, borderWidth: 1,
  },
  accountAvatar: { width: 52, height: 52, borderRadius: 26 },

  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, marginLeft: 4 },

  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  divider: { height: 1, marginLeft: 56 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 13 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  prefBlock: { padding: spacing.md, gap: spacing.sm },
  prefHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggle: { flexDirection: 'row', borderRadius: radius.md, padding: 4 },
  toggleItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.sm,
  },

  footer: { alignItems: 'center', gap: 2, marginTop: spacing.xxl },
  pressed: { opacity: 0.7 },
});
