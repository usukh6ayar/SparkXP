import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Image, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setStatusBarStyle } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/auth/AuthContext';
import { useSettings } from '../../src/settings/SettingsContext';
import * as usersApi from '../../src/api/users';
import * as classesApi from '../../src/api/classes';
import { getGamification, type Gamification } from '../../src/api/gamification';
import { MN_PROVINCES as PROVINCES, UB_DISTRICTS } from '../../src/constants/locations';
import { TopBar } from '../../src/components/TopBar';
import { AppText } from '../../src/components/Text';
import { Pill } from '../../src/components/Pill';
import { TextField } from '../../src/components/TextField';
import { SelectField } from '../../src/components/SelectField';
import { Button } from '../../src/components/Button';
import { resolveAvatar } from '../../src/lib/avatar';
import { colors, spacing, radius, tints, elevation, type PremiumPalette } from '../../src/theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Styles = ReturnType<typeof makeStyles>;

const avatarImg = require('../../assets/buddy-menu.png');

// Fallbacks until /gamification loads.
const STREAK = 0;
const LEVEL_SIZE = 1000;

/** Append an alpha channel to a 6-digit hex (e.g. tint fg → translucent circle). */
const alpha = (hex: string, a: number) =>
  hex + Math.round(a * 255).toString(16).padStart(2, '0');

const ROLE_LABEL: Record<string, string> = {
  student: 'Сурагч', teacher: 'Багш', admin: 'Админ', super_admin: 'Супер админ',
};

/** Dark section header — h2 title + optional "see all" action. */
function SectionHead({ p, st, title, actionLabel, onAction, style }: {
  p: PremiumPalette; st: Styles; title: string; actionLabel?: string; onAction?: () => void; style?: object;
}) {
  return (
    <View style={[st.sectionHead, style]}>
      <AppText variant="h2" color={p.text}>{title}</AppText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <AppText variant="label" color={p.primaryLight}>{actionLabel}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A usage / limit row with a thin progress bar (turns red when over). */
function UsageBar({ p, st, label, used, limit, unit }: {
  p: PremiumPalette; st: Styles; label: string; used: number; limit: number; unit: string;
}) {
  const pct = limit > 0 ? Math.min(used / limit, 1) : 0;
  const over = used >= limit;
  const u = unit ? ` ${unit}` : '';
  return (
    <View style={{ gap: 4 }}>
      <View style={st.usageTop}>
        <AppText variant="caption" color={p.textSecondary}>{label}</AppText>
        <AppText variant="caption" color={over ? colors.danger : p.textSecondary}>
          {used}{u} / {limit}{u}
        </AppText>
      </View>
      <View style={st.usageTrack}>
        <View style={[st.usageFill, { width: `${Math.max(pct * 100, 3)}%`, backgroundColor: over ? colors.danger : p.primaryLight }]} />
      </View>
    </View>
  );
}

const ACHIEVEMENTS: { icon: IconName; label: string; tint: { bg: string; fg: string }; earned: boolean }[] = [
  { icon: 'book', label: 'Анхны хичээл', tint: tints.purple, earned: true },
  { icon: 'trophy', label: 'Шилдэг сурагч', tint: tints.amber, earned: true },
  { icon: 'flash', label: '10 дараалал', tint: tints.blue, earned: true },
  { icon: 'calendar', label: '7 хоног дараалал', tint: tints.green, earned: true },
  { icon: 'diamond', label: '100 очирхон', tint: tints.purple, earned: false },
];

export default function ProfileScreen() {
  const { user, token, logout } = useAuth();
  const { palette: p, theme, t } = useSettings();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(p, theme === 'dark'), [p, theme]);
  const [editing, setEditing] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; teacherName: string | null }[]>([]);
  const [plan, setPlan] = useState<usersApi.PlanInfo | null>(null);
  const [gam, setGam] = useState<Gamification | null>(null);

  // Enrolled classes (+ which teacher), plan and gamification — refetched on focus.
  const loadProfile = useCallback(async () => {
    if (!token) return;
    usersApi.getMyPlan(token).then(setPlan).catch(() => {});
    getGamification(token).then(setGam).catch(() => {});
    try {
      const mine = await classesApi.getMyClasses(token);
      const details = await Promise.all(mine.enrolled.map((c) => classesApi.getClass(c.id, token)));
      setClasses(details.map((dt) => ({ id: dt.id, name: dt.name, teacherName: dt.teacher?.fullName ?? null })));
    } catch {
      // ignore
    }
  }, [token]);

  // Refetch on focus + set the status bar to suit the active theme.
  useFocusEffect(
    useCallback(() => {
      loadProfile();
      setStatusBarStyle(theme === 'dark' ? 'light' : 'dark');
      return () => setStatusBarStyle('dark');
    }, [loadProfile, theme]),
  );

  const soon = () => Alert.alert(t('comingSoon'), t('comingSoonBody'));
  const confirmLogout = () =>
    Alert.alert(t('logoutConfirm'), '', [
      { text: t('cancel') },
      { text: t('logout'), style: 'destructive', onPress: logout },
    ]);

  const xp = user?.xp ?? 0;
  const sparks = user?.sparks ?? 0;
  // Real gamification (backend curve) with a local fallback until it loads.
  const level = gam?.level ?? Math.floor(xp / LEVEL_SIZE) + 1;
  const pct = gam ? Math.round(gam.progress * 100) : Math.round(((xp % LEVEL_SIZE) / LEVEL_SIZE) * 100);
  const levelXp = gam?.levelXp ?? xp % LEVEL_SIZE;
  const levelTarget = gam?.levelTarget ?? LEVEL_SIZE;
  const streak = gam?.currentStreak ?? STREAK;
  const lessonsDone = gam?.lessonsDone ?? 0;
  const quizzesDone = gam?.quizzesDone ?? 0;

  const STATS = [
    { icon: 'flame' as IconName, value: streak, label: 'Өдөр дараалал', color: colors.streak },
    { icon: 'diamond' as IconName, value: sparks, label: 'Очирхон', color: colors.sparks },
    { icon: 'trophy' as IconName, value: quizzesDone, label: 'Сорил', color: colors.xp },
    { icon: 'book' as IconName, value: lessonsDone, label: 'Хичээл', color: p.primaryLight },
  ];

  const QUICK: { icon: IconName; label: string; tint: { bg: string; fg: string }; onPress: () => void }[] = [
    { icon: 'person', label: 'Миний мэдээлэл', tint: tints.blue, onPress: () => setEditing(true) },
    { icon: 'stats-chart', label: 'Миний ахиц', tint: tints.pink, onPress: () => router.push('/leaderboard') },
    { icon: 'bookmark', label: 'Хадгалсан', tint: tints.green, onPress: () => router.push('/saved') },
    { icon: 'notifications', label: 'Мэдэгдэл', tint: tints.orange, onPress: soon },
    { icon: 'gift', label: 'Шагналууд', tint: tints.purple, onPress: soon },
    { icon: 'time', label: 'Сүүлийн үзсэн', tint: tints.blue, onPress: soon },
    { icon: 'heart', label: 'Дуртай', tint: tints.pink, onPress: soon },
    { icon: 'settings', label: t('settings'), tint: tints.teal, onPress: () => router.push('/settings') },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={p.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="h1" color={p.text}>{t('profile')}</AppText>
            <View style={styles.headerActions}>
              <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.iconBtn}>
                <Ionicons name="settings-outline" size={20} color={p.text} />
              </Pressable>
              <View style={styles.diamondBadge}>
                <Ionicons name="diamond" size={16} color={colors.sparks} />
                <AppText variant="label" color={p.text}>{sparks}</AppText>
              </View>
            </View>
          </View>

          {/* Profile hero — panel + glowing avatar */}
          <View style={styles.hero}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatarGlow} />
              <Pressable onPress={() => router.push('/avatar')}>
                <LinearGradient colors={[p.primaryLight, p.primary]} style={styles.avatarRing}>
                  <Image source={resolveAvatar(user?.avatarUrl) ?? avatarImg} style={styles.avatar} resizeMode="cover" />
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.editBtn} onPress={() => router.push('/avatar')} hitSlop={6}>
                <Ionicons name="camera" size={13} color={colors.white} />
              </Pressable>
            </View>

            <View style={styles.heroInfo}>
              <View style={styles.nameRow}>
                <AppText variant="h2" color={p.text} numberOfLines={1}>{user?.fullName}</AppText>
                <Ionicons name="checkmark-circle" size={18} color={p.primaryLight} />
              </View>
              <Pill label={ROLE_LABEL[user?.role ?? 'student'] ?? 'Сурагч'} bg={alpha(p.primary, 0.22)} fg={p.primaryLight} />
              <View style={styles.levelRow}>
                <Ionicons name="star" size={15} color={colors.xp} />
                <AppText variant="bodyStrong" color={p.text}>Түвшин {level}</AppText>
              </View>
              {/* XP progress */}
              <View style={styles.xpTrack}>
                <LinearGradient
                  colors={[p.primaryLight, p.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.xpFill, { width: `${Math.max(pct, 4)}%` }]}
                />
              </View>
              <AppText variant="caption" color={p.textMuted} style={styles.levelXp}>{levelXp} / {levelTarget} XP</AppText>
            </View>
          </View>

          {/* Stats — one card, four divided columns */}
          <View style={styles.statsCard}>
            {STATS.map((s, i) => (
              <View key={s.label} style={[styles.statCell, i > 0 && styles.statCellBorder]}>
                <Ionicons name={s.icon} size={22} color={s.color} />
                <AppText variant="h3" color={p.text} style={styles.statValue}>{s.value}</AppText>
                <AppText variant="caption" color={p.textMuted} center numberOfLines={2}>{s.label}</AppText>
              </View>
            ))}
          </View>

          {/* Plan / limits */}
          {plan ? (
            <View style={styles.planCard}>
              <View style={styles.planTop}>
                <View style={{ flex: 1 }}>
                  <AppText variant="overline" color={p.textMuted}>МИНИЙ БАГЦ</AppText>
                  <AppText variant="h3" color={p.text}>{plan.planName}</AppText>
                </View>
                <View style={[styles.planBadge, { backgroundColor: plan.isFree ? alpha(p.primary, 0.22) : colors.xp }]}>
                  <Ionicons name={plan.isFree ? 'leaf' : 'star'} size={12} color={plan.isFree ? p.primaryLight : colors.white} />
                  <AppText variant="caption" color={plan.isFree ? p.primaryLight : colors.white}>
                    {plan.isFree ? t('free') : 'Premium'}
                  </AppText>
                </View>
              </View>
              {plan.limits ? (
                <View style={styles.planUsage}>
                  {plan.limits.voiceMinutes != null ? (
                    <UsageBar p={p} st={styles} label="AI яриа" used={plan.usage.voiceMinutes} limit={plan.limits.voiceMinutes} unit="мин" />
                  ) : null}
                  {plan.limits.dictionaryAi != null ? (
                    <UsageBar p={p} st={styles} label="Толь бичиг" used={plan.usage.dictionaryAi} limit={plan.limits.dictionaryAi} unit="" />
                  ) : null}
                  {plan.limits.memoryMb != null ? (
                    <UsageBar p={p} st={styles} label="Санах ой" used={plan.usage.memoryMb} limit={plan.limits.memoryMb} unit="MB" />
                  ) : null}
                </View>
              ) : (
                <AppText variant="caption" color={p.textSecondary} style={{ marginTop: 6 }}>
                  Premium багцаар AI яриа, толь бичиг зэрэг илүү боломжийг нээгээрэй.
                </AppText>
              )}
            </View>
          ) : null}

          {/* Achievements — large collectible badges */}
          <SectionHead p={p} st={styles} title="Миний амжилтууд" actionLabel="Бүгдийг харах ›" onAction={soon} style={styles.section} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achRow}>
            {ACHIEVEMENTS.map((a) => (
              <View key={a.label} style={styles.achItem}>
                {a.earned ? (
                  <View style={[styles.achBadge, { backgroundColor: alpha(a.tint.fg, 0.14), borderColor: alpha(a.tint.fg, 0.4) }]}>
                    <Ionicons name={a.icon} size={32} color={a.tint.fg} />
                  </View>
                ) : (
                  <View style={[styles.achBadge, styles.achLocked]}>
                    <Ionicons name="lock-closed" size={28} color={p.textMuted} />
                  </View>
                )}
                <AppText variant="caption" color={p.textSecondary} center numberOfLines={2} style={styles.achLabel}>{a.label}</AppText>
              </View>
            ))}
          </ScrollView>

          {/* Quick menu */}
          <SectionHead p={p} st={styles} title="Түргэн цэс" style={styles.section} />
          <View style={styles.quickGrid}>
            {QUICK.map((q) => (
              <Pressable key={q.label} style={({ pressed }) => [styles.quickItem, pressed && styles.pressed]} onPress={q.onPress}>
                <View style={[styles.quickIcon, { backgroundColor: alpha(q.tint.fg, 0.16) }]}>
                  <Ionicons name={q.icon} size={22} color={q.tint.fg} />
                </View>
                <AppText variant="caption" color={p.textSecondary} center numberOfLines={1} style={styles.quickLabel}>{q.label}</AppText>
              </Pressable>
            ))}
          </View>

          {/* My classes — which teacher's class the student joined */}
          <SectionHead
            p={p} st={styles}
            title="Миний ангиуд"
            actionLabel="Анги нэгдэх ›"
            onAction={() => router.push('/join')}
            style={styles.section}
          />
          {classes.length === 0 ? (
            <Pressable style={styles.joinEmpty} onPress={() => router.push('/join')}>
              <Ionicons name="add-circle-outline" size={20} color={p.primaryLight} />
              <AppText variant="body" color={p.textSecondary}>Анги нэгдээгүй байна — нэгдэх</AppText>
            </Pressable>
          ) : (
            classes.map((c) => (
              <View key={c.id} style={styles.classRow}>
                <View style={styles.classIcon}>
                  <Ionicons name="people" size={18} color={p.primaryLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" color={p.text} numberOfLines={1}>{c.name}</AppText>
                  {c.teacherName ? <AppText variant="caption" color={p.textMuted}>Багш: {c.teacherName}</AppText> : null}
                </View>
              </View>
            ))
          )}

          {/* Premium banner — gradient feature card */}
          <Pressable onPress={soon} style={({ pressed }) => pressed && styles.pressed}>
            <LinearGradient colors={['#7A4DFF', '#5A28F0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premium}>
              <View style={styles.premGlow} pointerEvents="none" />
              <View style={{ flex: 1 }}>
                <View style={styles.premiumTitleRow}>
                  <AppText style={styles.crown}>👑</AppText>
                  <AppText variant="h3" color={colors.white}>SparkXP Premium</AppText>
                </View>
                <AppText variant="caption" color="rgba(255,255,255,0.85)" style={styles.premiumSub}>
                  Давуу эрх, илүү их боломжууд
                </AppText>
                <View style={styles.premiumBtn}>
                  <AppText variant="bodyStrong" color={colors.primary}>Дэлгэрэнгүй →</AppText>
                </View>
              </View>
              <AppText style={styles.treasure}>💎</AppText>
            </LinearGradient>
          </Pressable>

          {/* Logout */}
          <Pressable style={styles.logout} onPress={confirmLogout} hitSlop={8}>
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <AppText variant="bodyStrong" color={colors.danger}>{t('logout')}</AppText>
          </Pressable>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      <EditProfileModal
        visible={editing}
        onClose={() => setEditing(false)}
        initialName={user?.fullName ?? ''}
        token={token}
      />
    </View>
  );
}

/** Edit-profile modal — keeps the existing PATCH /api/users/me logic. */
function EditProfileModal({
  visible, onClose, initialName, token,
}: {
  visible: boolean; onClose: () => void; initialName: string; token: string | null;
}) {
  const { colors: c } = useSettings();
  const [fullName, setFullName] = useState(initialName);
  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [saving, setSaving] = useState(false);
  const isUB = province === 'Улаанбаатар';

  async function save() {
    if (!fullName.trim()) { Alert.alert('Алдаа', 'Нэрээ оруулна уу.'); return; }
    setSaving(true);
    try {
      await usersApi.updateProfile(
        { fullName: fullName.trim(), province: province || undefined, district: isUB ? district || undefined : undefined },
        token!,
      );
      Alert.alert('Амжилттай', 'Профайл шинэчлэгдлээ.');
      onClose();
    } catch {
      Alert.alert('Алдаа', 'Хадгалахад алдаа гарлаа.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[modalStyles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
        <TopBar title="Профайл засах" showBadges={false} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          <TextField label="Бүтэн нэр" value={fullName} onChangeText={setFullName} placeholder="Нэрээ оруулна уу" />
          <SelectField
            label="Аймаг / Хот" value={province} options={PROVINCES}
            placeholder="Сонгох (заавал биш)"
            onSelect={(v) => { setProvince(v); setDistrict(''); }}
          />
          {isUB && (
            <SelectField label="Дүүрэг" value={district} options={UB_DISTRICTS} placeholder="Дүүрэг сонгох" onSelect={setDistrict} />
          )}
          <Button label={saving ? 'Хадгалж байна...' : 'Хадгалах'} onPress={save} disabled={saving} style={{ marginTop: spacing.lg }} />
          <Button label="Болих" variant="secondary" onPress={onClose} style={{ marginTop: spacing.md }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  safe: { flex: 1 }, // backgroundColor applied inline (reactive to theme)
});

const makeStyles = (p: PremiumPalette, isDark: boolean) => {
  // Dark cards need a border (shadows are invisible on the dark bg); light cards
  // drop the border and lift with a soft shadow so they look crisp, not framey.
  const cardEdge = isDark
    ? { borderWidth: 1, borderColor: p.cardBorder }
    : (elevation.sm as object);
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: p.bgFlat },
  safe: { flex: 1 },
  container: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },

  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: p.card, ...cardEdge,
  },
  diamondBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: p.card, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.full,
    ...cardEdge,
  },

  // Hero
  hero: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.lg,
    borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.lg,
    backgroundColor: p.card, ...cardEdge,
  },
  avatarOuter: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center' },
  avatarGlow: {
    position: 'absolute', top: -8, left: -8, width: 116, height: 116, borderRadius: 58,
    backgroundColor: 'rgba(124,77,255,0.35)',
  },
  avatarRing: {
    width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: p.track },
  editBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15,
    backgroundColor: p.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: p.card,
  },
  heroInfo: { flex: 1, gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  xpTrack: { height: 12, borderRadius: 6, backgroundColor: p.track, overflow: 'hidden', marginTop: 4 },
  xpFill: { height: 12, borderRadius: 6 },
  levelXp: { alignSelf: 'flex-end', marginTop: 3 },

  section: { marginTop: spacing.xxl },

  // Plan
  planCard: {
    backgroundColor: p.card, borderRadius: radius.lg, padding: spacing.lg,
    marginTop: spacing.lg, ...cardEdge,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.full,
  },
  planUsage: { marginTop: spacing.md, gap: spacing.sm },
  usageTop: { flexDirection: 'row', justifyContent: 'space-between' },
  usageTrack: { height: 6, borderRadius: 3, backgroundColor: p.track, overflow: 'hidden' },
  usageFill: { height: 6, borderRadius: 3 },

  // Classes
  joinEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: alpha('#6C3BFF', 0.14), borderRadius: radius.lg, padding: spacing.md,
    ...cardEdge,
  },
  classRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: p.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    ...cardEdge,
  },
  classIcon: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: alpha('#6C3BFF', 0.18),
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats
  statsCard: {
    flexDirection: 'row', backgroundColor: p.card,
    borderRadius: radius.xl, paddingVertical: spacing.lg, marginTop: spacing.lg,
    ...cardEdge,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 5, paddingHorizontal: 4 },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: p.divider },
  statValue: { marginTop: 2 },

  // Achievements
  achRow: { gap: spacing.md, paddingRight: spacing.lg, paddingVertical: spacing.xs },
  achItem: { alignItems: 'center', width: 84 },
  achBadge: { width: 74, height: 74, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  achLocked: { backgroundColor: p.track, borderColor: p.divider },
  achLabel: { marginTop: spacing.sm },

  // Quick menu
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  quickItem: {
    width: '23%', aspectRatio: 0.86, backgroundColor: p.card, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: 2,
    ...cardEdge,
  },
  quickIcon: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { marginTop: 2 },

  // Premium
  premium: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xxl, overflow: 'hidden',
    shadowColor: '#6C3BFF', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  premGlow: { position: 'absolute', top: -40, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' },
  premiumTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  crown: { fontSize: 18 },
  premiumSub: { marginTop: 4, marginBottom: spacing.md },
  premiumBtn: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  treasure: { fontSize: 52 },

  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xxl },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  });
};
