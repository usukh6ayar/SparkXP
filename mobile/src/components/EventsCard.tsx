import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { AppIcon } from './AppIcon';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, tints, type AppColors } from '../theme/theme';
import { t } from '../i18n';
import type { AppEvent, EventType } from '../api/events';

type IconName = keyof typeof Ionicons.glyphMap;

/** Visual identity per event kind (icon + brand tint). */
const STYLE: Record<EventType, { icon: IconName; tint: { bg: string; fg: string } }> = {
  daily: { icon: 'today', tint: tints.purple },
  weekly_challenge: { icon: 'trophy', tint: tints.blue },
  double_xp: { icon: 'flash', tint: tints.amber },
};

/** ms → a compact live label: "2ө 5ц" for days, else "H:MM:SS". */
function formatLeft(ms: number): string {
  if (ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}${t('unitDayShort')} ${h}${t('unitHourShort')}`;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** A live countdown to `endsAt`, re-rendered once a second. */
function Countdown({ endsAt, color }: { endsAt: string; color: string }) {
  const target = new Date(endsAt).getTime();
  const [left, setLeft] = useState(() => target - Date.now());
  useEffect(() => {
    const id = setInterval(() => setLeft(target - Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return (
    <View style={styles.countRow}>
      <Ionicons name="time-outline" size={13} color={color} />
      <AppText variant="label" color={color}>{t('eventEndsIn')} {formatLeft(left)}</AppText>
    </View>
  );
}

/**
 * Home "Events" strip — Daily / Weekly challenge / Double XP, each with a live
 * countdown. Server-driven (`GET /events/active`); renders nothing when no event
 * is live, so it never leaves an empty header on the page.
 */
export function EventsCard({ events }: { events: AppEvent[] }) {
  const c = useColors();
  const styles2 = makeStyles(c);
  if (!events.length) return null;

  return (
    <>
      <View style={styles2.head}>
        <AppText variant="h2">{t('eventsTitle')}</AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles2.row}
      >
        {events.map((e) => {
          const s = STYLE[e.type] ?? STYLE.daily;
          return (
            <View key={e.id} style={[styles2.card, { borderColor: s.tint.fg }]}>
              <View style={styles2.cardTop}>
                <View style={[styles2.icon, { backgroundColor: s.tint.bg }]}>
                  {e.type === 'double_xp' ? (
                    <AppIcon name="xp" size={22} />
                  ) : (
                    <Ionicons name={s.icon} size={20} color={s.tint.fg} />
                  )}
                </View>
                {e.rewardXp ? (
                  <View style={[styles2.reward, { backgroundColor: s.tint.bg }]}>
                    <AppIcon name="xp" size={13} />
                    <AppText variant="label" color={s.tint.fg}>+{e.rewardXp}</AppText>
                  </View>
                ) : e.type === 'double_xp' ? (
                  <View style={[styles2.reward, { backgroundColor: s.tint.bg }]}>
                    <AppText variant="label" color={s.tint.fg}>{t('eventDoubleXp')}</AppText>
                  </View>
                ) : null}
              </View>
              <AppText variant="bodyStrong" numberOfLines={1} style={styles2.title}>{e.title}</AppText>
              {e.description ? (
                <AppText variant="caption" color={c.textSecondary} numberOfLines={2}>{e.description}</AppText>
              ) : null}
              <Countdown endsAt={e.endsAt} color={c.textSecondary} />
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
});

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    head: { marginTop: spacing.xl, marginBottom: spacing.md },
    row: { gap: spacing.md, paddingRight: spacing.lg },
    card: {
      width: 220,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      padding: spacing.md,
      gap: 4,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
    icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
    reward: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
    title: { marginTop: 2 },
  });
