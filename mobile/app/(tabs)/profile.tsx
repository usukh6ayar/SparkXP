import { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Share, RefreshControl } from 'react-native';
import { haptics } from '../../src/lib/haptics';
import { AppImage } from '../../src/components/AppImage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../src/auth/AuthContext';
import { useSettings } from '../../src/settings/SettingsContext';
import * as usersApi from '../../src/api/users';
import * as classesApi from '../../src/api/classes';
import { getGamification, type Gamification } from '../../src/api/gamification';
import {
  getAchievements,
  ACHIEVEMENTS_PATH,
  type AchievementsResponse,
  type Trophy,
} from '../../src/api/achievements';
import { useSWR } from '../../src/api/useSWR';
import { AppText } from '../../src/components/Text';
import { AppIcon } from '../../src/components/AppIcon';
import { DictionaryButton } from '../../src/components/DictionaryButton';
import { IconButton } from '../../src/components/IconButton';
import { type AppIconName } from '../../src/constants/appIcons';
import { CountUp } from '../../src/components/CountUp';
import { ProgressRing } from '../../src/components/ProgressRing';
import { EditProfileModal } from '../../src/components/EditProfileModal';
import { AnalyticsSection } from '../../src/components/AnalyticsSection';
import { resolveAvatar } from '../../src/lib/avatar';
import { useAvatarPicker } from '../../src/lib/useAvatarPicker';
import { useLogoutConfirm, useComingSoon } from '../../src/lib/useLogoutConfirm';
import { tf } from '../../src/i18n';
import { colors, spacing, radius, tints, elevation, type PremiumPalette, progressGradients } from '../../src/theme/theme';
import { bounded } from '../../src/theme/responsive';

type Styles = ReturnType<typeof makeStyles>;

const avatarImg = require('../../assets/buddy-menu.webp');

// Fallbacks until /gamification loads.
const STREAK = 0;
const LEVEL_SIZE = 1000;

/** Append an alpha channel to a 6-digit hex (e.g. tint fg → translucent circle). */
const alpha = (hex: string, a: number) =>
  hex + Math.round(a * 255).toString(16).padStart(2, '0');

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

/** How many badges the profile preview row shows before "see all". */
const ACH_PREVIEW = 8;

export default function ProfileScreen() {
  const { user, token } = useAuth();
  const { palette: p, theme, t } = useSettings();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(p, theme === 'dark'), [p, theme]);
  const [editing, setEditing] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; teacherName: string | null }[]>([]);
  const [plan, setPlan] = useState<usersApi.PlanInfo | null>(null);
  const [gam, setGam] = useState<Gamification | null>(null);
  // Trophies. Same cache key as the /trophies screen, so opening it is instant.
  const { data: ach } = useSWR<AchievementsResponse>(
    ACHIEVEMENTS_PATH,
    () => getAchievements(token!),
    { enabled: Boolean(token) },
  );

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

  // Refetch on focus. (The status bar is handled app-wide in `app/_layout.tsx`.)
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const soon = useComingSoon();
  const confirmLogout = useLogoutConfirm();
  const { pickPhoto, busy: avatarBusy } = useAvatarPicker();

  // The default avatar (buddy-menu.webp) is a fox STICKER with padding around
  // it, so `cover` in the circle leaves the fox looking small. When it's the
  // default we oversize + crop the padding (like the buddy tab); an uploaded
  // photo has no padding and fills the circle as-is.
  const avatarUrl = resolveAvatar(user?.avatarUrl);
  const isDefaultAvatar = !avatarUrl;

  // CEFR level (B1/B2…) chosen at registration; fall back to the graded level.
  const cefr = (user?.level ?? gam?.cefrLevel ?? '').toUpperCase();
  // Place chip on the status card (§3.3): province · district, omitted if unset.
  const place = [user?.province, user?.district].filter(Boolean).join(' · ');

  // Share a short "come learn with me" blurb via the OS share sheet.
  const shareProfile = () =>
    Share.share({ message: tf('shareProfileBody', { name: user?.fullName ?? 'SparkXP' }) });

  const xp = user?.xp ?? 0;
  const sparks = user?.sparks ?? 0;
  // Real gamification (backend curve) with a local fallback until it loads.
  const level = gam?.level ?? Math.floor(xp / LEVEL_SIZE) + 1;
  const pct = gam ? Math.round(gam.progress * 100) : Math.round(((xp % LEVEL_SIZE) / LEVEL_SIZE) * 100);
  const streak = gam?.currentStreak ?? STREAK;
  const lessonsDone = gam?.lessonsDone ?? 0;
  const quizzesDone = gam?.quizzesDone ?? 0;

  // Real trophies from GET /achievements, in order of preference:
  // the ones the user pinned (from the trophy screen) → everything they won →
  // the first few locked ones, so the row reads as a goal rather than a gap.
  const bySlug = new Map((ach?.trophies ?? []).map((tr) => [tr.slug, tr]));
  const pinnedTrophies = (ach?.pinned ?? [])
    .map((slug) => bySlug.get(slug))
    .filter((tr): tr is Trophy => Boolean(tr));
  const earnedTrophies = ach?.trophies.filter((tr) => tr.earned) ?? [];
  const achPreview = (
    pinnedTrophies.length ? pinnedTrophies : earnedTrophies.length ? earnedTrophies : (ach?.trophies ?? [])
  ).slice(0, ACH_PREVIEW);

  const STATS: { icon: AppIconName; value: number; label: string }[] = [
    { icon: 'streak', value: streak, label: t('statStreak') },
    { icon: 'sparks', value: sparks, label: t('sparks') },
    { icon: 'trophy', value: quizzesDone, label: t('statQuizzes') },
    { icon: 'reading', value: lessonsDone, label: t('statLessons') },
  ];

  // Quick menu. "My info" lives in the hero Edit-profile button (Instagram-style),
  // and settings lives in the header — so neither is repeated here.
  const QUICK: { icon: AppIconName; label: string; tint: { bg: string; fg: string }; onPress: () => void }[] = [
    { icon: 'stats', label: t('myProgress'), tint: tints.pink, onPress: () => router.push('/leaderboard') },
    { icon: 'saved', label: t('saved'), tint: tints.green, onPress: () => router.push('/saved') },
    { icon: 'notifications', label: t('notifications'), tint: tints.orange, onPress: () => router.push('/notifications') },
    { icon: 'gift', label: t('inviteFriends'), tint: tints.purple, onPress: () => router.push('/invite') },
    { icon: 'time', label: t('recentlyViewed'), tint: tints.blue, onPress: soon },
    { icon: 'heart', label: t('favorites'), tint: tints.pink, onPress: soon },
  ];

  return (
    <View style={styles.root}>
      <LinearGradient colors={p.bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.container, bounded]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => { haptics.tap(); loadProfile(); }} tintColor={p.primary} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <AppText variant="h1" color={p.text}>{t('profile')}</AppText>
            {/* One consistent control row: same-size round buttons + a matching
                Sparks pill, all on the card colour so the header reads tidy. */}
            <View style={styles.headerActions}>
              <DictionaryButton size={44} iconSize={22} iconColor={p.text} style={styles.headerIcon} />
              <IconButton
                icon="settings-outline"
                size={44}
                iconSize={22}
                iconColor={p.text}
                onPress={() => router.push('/settings')}
                accessibilityLabel={t('settings')}
                style={styles.headerIcon}
              />
              <View style={styles.diamondBadge}>
                <AppIcon name="sparks" size={22} />
                <AppText variant="label" color={p.text}>{sparks}</AppText>
              </View>
            </View>
          </View>

          {/* Status card (§3.3) — identity + the four stats in ONE radius.xl card
              with a crown gradient. The avatar (tap to change) carries the XP ring
              and level badge; edit + share sit top-right; the four stats sit below
              on the card surface, inside the same border. */}
          <View style={styles.statusCard}>
            <LinearGradient colors={colors.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.crownGrad}>
              <View style={styles.crownTop}>
                <View style={styles.avatarWrap}>
                  <ProgressRing progress={pct / 100} size={88} stroke={4} gradient={progressGradients.xp} track="rgba(255,255,255,0.28)">
                    <Pressable onPress={pickPhoto} disabled={avatarBusy} style={styles.avatarClip}>
                      <AppImage
                        source={avatarUrl ?? avatarImg}
                        width={200}
                        style={isDefaultAvatar ? styles.avatarDefault : styles.avatarFill}
                        contentFit="cover"
                      />
                    </Pressable>
                  </ProgressRing>
                  <View style={styles.levelBadgeWrap} pointerEvents="none">
                    <View style={styles.levelBadge}>
                      <AppText variant="label" color={colors.white}>{level}</AppText>
                    </View>
                  </View>
                </View>
                <View style={styles.crownActions}>
                  <Pressable onPress={() => setEditing(true)} hitSlop={8} style={styles.crownIcon} accessibilityRole="button" accessibilityLabel={t('editProfile')}>
                    <Ionicons name="pencil" size={15} color={colors.white} />
                  </Pressable>
                  <Pressable onPress={shareProfile} hitSlop={8} style={styles.crownShare} accessibilityRole="button" accessibilityLabel={t('shareProfile')}>
                    <Ionicons name="share-social" size={14} color={colors.white} />
                    <AppText variant="label" color={colors.white}>{t('shareProfile')}</AppText>
                  </Pressable>
                </View>
              </View>

              <AppText variant="h2" color={colors.white} numberOfLines={1} style={styles.crownName}>{user?.fullName}</AppText>
              {user?.username ? (
                <AppText variant="caption" color="rgba(255,255,255,0.85)">@{user.username}</AppText>
              ) : null}

              <View style={styles.crownChips}>
                <View style={styles.crownChip}>
                  <AppText variant="label" color={colors.white}>
                    {cefr || `${t('levelLabel')} ${level}`}
                  </AppText>
                </View>
                {place ? (
                  <View style={styles.crownChip}>
                    <Ionicons name="location" size={12} color="rgba(255,255,255,0.9)" />
                    <AppText variant="label" color={colors.white}>{place}</AppText>
                  </View>
                ) : null}
              </View>
            </LinearGradient>

            {/* Four stats, on the card surface, inside the same border. */}
            <View style={styles.statsRow}>
              {STATS.map((s, i) => (
                <View key={s.label} style={[styles.statCell, i > 0 && styles.statCellBorder]}>
                  <AppIcon name={s.icon} size={28} />
                  <CountUp value={s.value} variant="h3" color={p.text} style={styles.statValue} />
                  <AppText variant="caption" color={p.textMuted} center numberOfLines={1}>{s.label}</AppText>
                </View>
              ))}
            </View>
          </View>

          {/* Plan / limits */}
          {plan ? (
            <View style={styles.planCard}>
              <View style={styles.planTop}>
                <View style={{ flex: 1 }}>
                  <AppText variant="overline" color={p.textMuted}>{t('myPlan').toUpperCase()}</AppText>
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
                    <UsageBar p={p} st={styles} label={t('usageAiVoice')} used={plan.usage.voiceMinutes} limit={plan.limits.voiceMinutes} unit={t('unitMin')} />
                  ) : null}
                  {plan.limits.dictionaryAi != null ? (
                    <UsageBar p={p} st={styles} label={t('usageDictionary')} used={plan.usage.dictionaryAi} limit={plan.limits.dictionaryAi} unit="" />
                  ) : null}
                  {plan.limits.memoryMb != null ? (
                    <UsageBar p={p} st={styles} label={t('usageMemory')} used={plan.usage.memoryMb} limit={plan.limits.memoryMb} unit="MB" />
                  ) : null}
                </View>
              ) : (
                <AppText variant="caption" color={p.textSecondary} style={{ marginTop: 6 }}>
                  {t('premiumHint')}
                </AppText>
              )}
            </View>
          ) : null}

          {/* Statistics — learner analytics (GET /analytics/overview + history) */}
          <SectionHead p={p} st={styles} title={t('analyticsTitle')} style={styles.section} />
          <AnalyticsSection p={p} />

          {/* Achievements — real trophies from GET /achievements */}
          <SectionHead
            p={p}
            st={styles}
            title={t('myAchievements')}
            actionLabel={`${t('seeAll')} ›`}
            onAction={() => router.push('/trophies')}
            style={styles.section}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achRow}>
            {achPreview.map((tr) => (
              <Pressable key={tr.slug} style={styles.achItem} onPress={() => router.push('/trophies')}>
                {/* Always the 256px thumb — the full images are 8.7MB together. */}
                <View style={[styles.achBadge, !tr.earned && styles.achLocked]}>
                  <AppImage
                    source={tr.thumb}
                    width={128}
                    contentFit="contain"
                    style={[styles.achBadgeImg, !tr.earned && styles.achBadgeImgLocked]}
                  />
                </View>
                <AppText
                  variant="caption"
                  color={tr.earned ? p.textSecondary : p.textMuted}
                  center
                  numberOfLines={2}
                  style={styles.achLabel}
                >
                  {tr.name}
                </AppText>
              </Pressable>
            ))}
          </ScrollView>

          {/* Quick menu — 2-column grid of tappable cards */}
          <SectionHead p={p} st={styles} title={t('quickMenu')} style={styles.section} />
          <View style={styles.quickGrid}>
            {QUICK.map((q) => (
              <Pressable
                key={q.label}
                style={({ pressed }) => [styles.quickCell, pressed && styles.pressed]}
                onPress={q.onPress}
              >
                <View style={[styles.quickIcon, { backgroundColor: alpha(q.tint.fg, 0.16) }]}>
                  <AppIcon name={q.icon} size={42} />
                </View>
                <AppText variant="bodyStrong" color={p.text} numberOfLines={1} style={{ flex: 1 }}>{q.label}</AppText>
              </Pressable>
            ))}
          </View>

          {/* My classes — which teacher's class the student joined */}
          <SectionHead
            p={p} st={styles}
            title={t('myClasses')}
            actionLabel={`${t('joinClass')} ›`}
            onAction={() => router.push('/join')}
            style={styles.section}
          />
          {classes.length === 0 ? (
            <Pressable style={styles.joinEmpty} onPress={() => router.push('/join')}>
              <Ionicons name="add-circle-outline" size={20} color={p.primaryLight} />
              <AppText variant="body" color={p.textSecondary}>{t('noClass')}</AppText>
            </Pressable>
          ) : (
            classes.map((c) => (
              <View key={c.id} style={styles.classRow}>
                <View style={styles.classIcon}>
                  <Ionicons name="people" size={18} color={p.primaryLight} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppText variant="bodyStrong" color={p.text} numberOfLines={1}>{c.name}</AppText>
                  {c.teacherName ? <AppText variant="caption" color={p.textMuted}>{t('teacher')}: {c.teacherName}</AppText> : null}
                </View>
              </View>
            ))
          )}

          {/* Premium banner — gradient feature card → plan & usage screen */}
          <Pressable onPress={() => router.push('/plan')} style={({ pressed }) => pressed && styles.pressed}>
            <LinearGradient colors={[colors.primaryGradient[0], colors.primaryGradient[2]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.premium}>
              <View style={styles.premGlow} pointerEvents="none" />
              <View style={{ flex: 1 }}>
                <View style={styles.premiumTitleRow}>
                  <AppIcon name="gem" size={20} />
                  <AppText variant="h3" color={colors.white}>SparkXP Premium</AppText>
                </View>
                <AppText variant="caption" color="rgba(255,255,255,0.85)" style={styles.premiumSub}>
                  {t('premiumSubtitle')}
                </AppText>
                <View style={styles.premiumBtn}>
                  <AppText variant="bodyStrong" color={colors.primary}>{t('learnMore')} →</AppText>
                </View>
              </View>
              <AppIcon name="sparks" size={44} style={styles.treasure} />
            </LinearGradient>
          </Pressable>

          {/* Logout — the only destructive action on the screen, so it gets the
              same press feedback as every other card here (it had none) and an
              explicit button role for screen readers. */}
          <Pressable
            style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
            onPress={confirmLogout}
            accessibilityRole="button"
            accessibilityLabel={t('logout')}
          >
            <Ionicons name="log-out-outline" size={18} color={colors.danger} />
            <AppText variant="bodyStrong" color={colors.danger}>{t('logout')}</AppText>
          </Pressable>

          <View style={{ height: 120 }} />
        </ScrollView>
      </SafeAreaView>

      <EditProfileModal visible={editing} onClose={() => setEditing(false)} />
    </View>
  );
}

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
  // Shared look for the header round buttons (search + settings): the card
  // colour + edge, so they match each other and the Sparks pill. IconButton
  // supplies the size, circle shape and centring.
  headerIcon: { backgroundColor: p.card, ...cardEdge },
  diamondBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    height: 44, paddingHorizontal: spacing.md, borderRadius: radius.full,
    backgroundColor: p.card, ...cardEdge,
  },

  // Status card (§3.3) — one radius.xl card: crown gradient + stats below.
  statusCard: {
    borderRadius: radius.xl, marginTop: spacing.lg, overflow: 'hidden',
    backgroundColor: p.card, ...cardEdge,
  },
  crownGrad: { padding: spacing.lg },
  crownTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  avatarWrap: { width: 88, height: 88 },
  // The circle that clips the avatar. The image inside either fills it (uploaded
  // photo) or is oversized to crop the default fox sticker's padding.
  avatarClip: {
    width: 76, height: 76, borderRadius: 38, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  avatarFill: { width: 76, height: 76 },
  // 76 × 1.42 ≈ 108, centred (−16) and nudged down 3px so the fox — which sits
  // slightly above the sticker's centre — lands in the middle and fills.
  avatarDefault: { width: 108, height: 108, marginLeft: -16, marginTop: -13 },
  levelBadgeWrap: { position: 'absolute', bottom: -4, left: 0, right: 0, alignItems: 'center' },
  levelBadge: {
    minWidth: 24, paddingHorizontal: 6, height: 22, borderRadius: radius.full,
    backgroundColor: colors.primaryDark, borderWidth: 2, borderColor: colors.white,
    alignItems: 'center', justifyContent: 'center',
  },
  crownActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  crownIcon: {
    width: 34, height: 34, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center',
  },
  crownShare: {
    flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: spacing.md,
    borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.20)',
  },
  crownName: { marginTop: spacing.md },
  crownChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  crownChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },

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
    backgroundColor: alpha(colors.primary, 0.14), borderRadius: radius.lg, padding: spacing.md,
  },
  classRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: p.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
    ...cardEdge,
  },
  classIcon: {
    width: 40, height: 40, borderRadius: radius.full, backgroundColor: alpha(colors.primary, 0.18),
    alignItems: 'center', justifyContent: 'center',
  },

  // Stats — a row INSIDE the status card (top divider separates it from the crown).
  statsRow: {
    flexDirection: 'row', paddingVertical: spacing.lg,
    borderTopWidth: 1, borderTopColor: p.divider,
  },
  statCell: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  statCellBorder: { borderLeftWidth: 1, borderLeftColor: p.divider },
  statValue: { marginTop: 2 },

  // Achievements
  achRow: { gap: spacing.md, paddingRight: spacing.lg, paddingVertical: spacing.xs },
  achItem: { alignItems: 'center', width: 84 },
  achBadge: { width: 74, height: 74, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  achBadgeImg: { width: '86%', height: '86%' },
  // Locked badges stay readable as a goal, but clearly not yours yet.
  achBadgeImgLocked: { opacity: 0.28 },
  achLocked: { backgroundColor: p.track, borderColor: p.divider },
  achLabel: { marginTop: spacing.sm },

  // Quick menu — 2-column grid of compact cards
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickCell: {
    width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: p.card, borderRadius: radius.lg, padding: spacing.md, ...cardEdge,
  },
  quickIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  // Premium
  premium: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.xxl, overflow: 'hidden',
    shadowColor: colors.primary, shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8,
  },
  premGlow: { position: 'absolute', top: -40, right: -20, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.12)' },
  premiumTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  premiumSub: { marginTop: 4, marginBottom: spacing.md },
  premiumBtn: { alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: spacing.lg },
  treasure: { alignSelf: 'center' },

  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: spacing.xxl, paddingVertical: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.danger,
    backgroundColor: alpha(colors.danger, 0.08),
  },

  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  });
};
