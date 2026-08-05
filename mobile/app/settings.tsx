import { memo, useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppImage } from '../src/components/AppImage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/auth/AuthContext';
import { isBiometricAvailable } from '../src/auth/biometrics';
import { useSettings, type ThemePref } from '../src/settings/SettingsContext';
import { loadSoundEnabled, setSoundEnabled } from '../src/lib/sound';
import { AppText } from '../src/components/Text';
import { resolveAvatar } from '../src/lib/avatar';
import { useLogoutConfirm, useComingSoon } from '../src/lib/useLogoutConfirm';
import { DeleteAccountSheet } from '../src/components/DeleteAccountSheet';
import { openLegal } from '../src/constants/legal';
import { ROLE_TKEY } from '../src/constants/roles';
import { colors, spacing, radius, tints, type PremiumPalette } from '../src/theme/theme';
import type { Lang } from '../src/i18n';
import { bounded } from '../src/theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;
type Tint = { bg: string; fg: string };

const avatarImg = require('../assets/buddy-menu.webp');
const APP_VERSION = '1.0.0';

// Locally-persisted switch prefs (UI-only — nothing else reacts to them yet).
// Sound is NOT here: it lives in `lib/sound.ts` (default OFF) so the audio layer
// and this switch share one source of truth — see `useSoundPref` below.
const KEYS = { notifications: 'settings.notifications', haptics: 'settings.haptics' };

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

/**
 * One on/off switch.
 *
 * Two things keep it steady, both learned the hard way:
 * 1. It lives at MODULE level. A component declared inside another component's
 *    body is a NEW type on every render, so React unmounts and remounts it —
 *    flipping one switch remounted all the others and they flashed.
 * 2. It is `memo`ised and only ever fed STABLE props (see `usePref`), so
 *    flipping one switch no longer re-renders its neighbours mid-animation,
 *    which is what made their thumbs visibly grow/shrink.
 */
const Switcher = memo(function Switcher({
  p, value, onValueChange,
}: { p: PremiumPalette; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: p.track, true: p.primary }}
      thumbColor={colors.white}
      ios_backgroundColor={p.track}
    />
  );
});

/**
 * A locally-persisted on/off preference (loads once, saves on change).
 *
 * The returned setter has a STABLE identity — unlike an inline
 * `(v) => { set(v); save(v); }`, which is a new function on every render and
 * therefore re-renders the switch it feeds. That is exactly how the biometric
 * lock switch behaves (its setter is a `useCallback` in AuthContext), which is
 * why that one always animated cleanly.
 */
function usePref(key: string): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(key).then((v) => { if (v != null) setValue(v === '1'); });
  }, [key]);

  const set = useCallback((v: boolean) => {
    setValue(v);
    AsyncStorage.setItem(key, v ? '1' : '0');
  }, [key]);

  return [value, set];
}

/**
 * The sound-effect switch. Unlike `usePref` it defaults OFF (many learners study
 * in public) and drives `lib/sound.ts` — which owns persistence under the same
 * `settings.sound` key — so the switch and the audio layer never disagree.
 */
function useSoundPref(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(false);

  useEffect(() => { loadSoundEnabled().then(setValue); }, []);

  const set = useCallback((v: boolean) => {
    setValue(v);
    setSoundEnabled(v); // updates the live flag + persists
  }, []);

  return [value, set];
}

/** Small caps heading above a card group. */
function SectionLabel({ p, children }: { p: PremiumPalette; children: string }) {
  return (
    <AppText variant="overline" color={p.textMuted} style={styles.sectionLabel}>{children}</AppText>
  );
}

/** A two-option segmented toggle (icon + label per side). */
function SegToggle<T extends string>({
  p, options, value, onChange,
}: {
  p: PremiumPalette; options: Option<T>[]; value: T; onChange: (v: T) => void;
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
            {/* Three options share one row, so a long label must clip rather
                than wrap and make the pills uneven. */}
            <AppText variant="bodyStrong" numberOfLines={1} color={active ? colors.white : p.textSecondary}>{opt.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, biometricEnabled, setBiometricEnabled } = useAuth();
  const { themePref, lang, palette: p, setTheme, setLang, t } = useSettings();

  const [notifications, setNotifications] = usePref(KEYS.notifications);
  const [sound, setSound] = useSoundPref();
  const [haptics, setHaptics] = usePref(KEYS.haptics);
  // Only offer the biometric lock when the device actually supports it.
  const [bioAvailable, setBioAvailable] = useState(false);

  // (The status bar is handled app-wide in `app/_layout.tsx` — never per screen.)
  useFocusEffect(
    useCallback(() => {
      isBiometricAvailable().then(setBioAvailable);
    }, []),
  );

  const soon = useComingSoon();
  const confirmLogout = useLogoutConfirm();
  const [deleteOpen, setDeleteOpen] = useState(false);

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

        <ScrollView contentContainerStyle={[styles.container, bounded]} showsVerticalScrollIndicator={false}>
          {/* Account mini-card → full account hub */}
          <Pressable onPress={() => router.push('/account')}
            style={({ pressed }) => [styles.account, { backgroundColor: p.card, borderColor: p.cardBorder }, pressed && styles.pressed]}>
            <AppImage source={resolveAvatar(user?.avatarUrl) ?? avatarImg} width={120} style={[styles.accountAvatar, { backgroundColor: p.track }]} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" color={p.text} numberOfLines={1}>{user?.fullName ?? '—'}</AppText>
              <AppText variant="caption" color={p.textMuted}>
                {t(ROLE_TKEY[user?.role ?? 'student'] ?? 'roleStudent')}{user?.email ? ` · ${user.email}` : ''}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.textMuted} />
          </Pressable>

          {/* Appearance + Language */}
          <SectionLabel p={p}>{t('settings').toUpperCase()}</SectionLabel>
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.cardBorder }]}>
            <View style={styles.prefBlock}>
              <View style={styles.prefHead}>
                <Ionicons name="color-palette" size={18} color={tints.purple.fg} />
                <AppText variant="body" color={p.text}>{t('appearance')}</AppText>
              </View>
              {/* Bound to `themePref`, NOT `theme` — otherwise picking "Систем"
                  would light up Хар/Цайвар instead, since `theme` is resolved. */}
              <SegToggle<ThemePref> p={p} value={themePref} onChange={setTheme}
                options={[
                  { value: 'dark', label: t('dark'), icon: 'moon' },
                  { value: 'light', label: t('light'), icon: 'sunny' },
                  { value: 'system', label: t('themeSystem'), icon: 'phone-portrait' },
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
          <SectionLabel p={p}>{t('notificationsSound').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="notifications" tint={tints.coral} label={t('notifications')}
              right={<Switcher p={p} value={notifications} onValueChange={setNotifications} />} />
            <Row p={p} icon="volume-high" tint={tints.amber} label={t('sound')}
              right={<Switcher p={p} value={sound} onValueChange={setSound} />} />
            <Row p={p} icon="phone-portrait" tint={tints.teal} label={t('haptics')}
              right={<Switcher p={p} value={haptics} onValueChange={setHaptics} />} />
          </Card>

          {/* Security — biometric app-lock (only on devices that support it) */}
          {bioAvailable ? (
            <>
              <SectionLabel p={p}>{t('security').toUpperCase()}</SectionLabel>
              <Card p={p}>
                <Row p={p} icon="finger-print" tint={tints.green} label={t('biometricLock')}
                  right={<Switcher p={p} value={biometricEnabled} onValueChange={setBiometricEnabled} />} />
              </Card>
            </>
          ) : null}

          {/* Account */}
          <SectionLabel p={p}>{t('account').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="sparkles" tint={tints.purple} label={t('buddyMemory')} onPress={() => router.push('/buddy-memory')} />
            <Row p={p} icon="shield-checkmark" tint={tints.green} label={t('privacy')} onPress={() => openLegal('privacy')} />
          </Card>

          {/* Support */}
          <SectionLabel p={p}>{t('support').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="help-circle" tint={tints.blue} label={t('helpFaq')} onPress={soon} />
            <Row p={p} icon="chatbubble-ellipses" tint={tints.pink} label={t('sendFeedback')} onPress={soon} />
            <Row p={p} icon="star" tint={tints.amber} label={t('rateApp')} onPress={soon} />
            {/* Sharing the app IS the referral flow — `/invite` already carries
                the code + reward copy, so this points there instead of the
                bare OS share sheet (which gives the friend nothing to redeem). */}
            <Row p={p} icon="share-social" tint={tints.teal} label={t('shareApp')} onPress={() => router.push('/invite')} />
          </Card>

          {/* Legal */}
          <SectionLabel p={p}>{t('legal').toUpperCase()}</SectionLabel>
          <Card p={p}>
            <Row p={p} icon="document-text" tint={tints.purple} label={t('terms')} onPress={() => openLegal('terms')} />
            <Row p={p} icon="shield" tint={tints.green} label={t('privacyPolicy')} onPress={() => openLegal('privacy')} />
          </Card>

          {/* Dev tools — `__DEV__` only, so this never ships to a student.
              Metro strips the whole block from a release bundle. */}
          {__DEV__ ? (
            <>
              <SectionLabel p={p}>DEV</SectionLabel>
              <Card p={p}>
                <Row
                  p={p}
                  icon="color-palette"
                  tint={tints.pink}
                  label="Celebration scenes"
                  onPress={() => router.push('/celebration-preview')}
                />
              </Card>
            </>
          ) : null}

          {/* Logout + permanent account deletion.
              Deletion has to be reachable from inside the app — App Store
              Review Guideline 5.1.1(v). The sheet spells out what is lost and
              re-asks for the password before doing anything. */}
          <View style={{ marginTop: spacing.lg }}>
            <Card p={p}>
              <Row p={p} icon="log-out-outline" tint={tints.coral} label={t('logout')} danger onPress={confirmLogout} />
              <Row
                p={p}
                icon="trash-outline"
                tint={tints.coral}
                label={t('deleteAccount')}
                danger
                onPress={() => setDeleteOpen(true)}
              />
            </Card>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <AppText variant="caption" color={p.textMuted}>SparkXP v{APP_VERSION}</AppText>
            <AppText variant="caption" color={p.textMuted}>© Hustle Hive LLC</AppText>
          </View>
        </ScrollView>
      </SafeAreaView>

      <DeleteAccountSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} />
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
