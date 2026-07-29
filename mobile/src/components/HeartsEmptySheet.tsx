import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from './Text';
import { Button } from './Button';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius, type AppColors } from '../theme/theme';
import { t, tf } from '../i18n';
import type { HeartsState } from '../api/hearts';

/** mm:ss left until `iso`, or null once it has passed. */
function countdown(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return null;
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The blocking "out of hearts" screen (Duolingo-style). Shown over the quiz when
 * the server says hearts hit 0 (never on a local count). The learner either
 * spends Sparks to refill or waits out the regen timer — the parent re-checks
 * hearts and dismisses this once there is a heart to spend.
 */
export function HeartsEmptySheet({
  hearts, sparks, refilling, onRefill, onQuit,
}: {
  hearts: HeartsState;
  sparks: number;
  refilling: boolean;
  onRefill: () => void;
  onQuit: () => void;
}) {
  const c = useColors();
  const styles = makeStyles(c);

  // Tick every second so the regen countdown stays live.
  const [left, setLeft] = useState<string | null>(() => countdown(hearts.nextHeartAt));
  useEffect(() => {
    setLeft(countdown(hearts.nextHeartAt));
    const id = setInterval(() => setLeft(countdown(hearts.nextHeartAt)), 1000);
    return () => clearInterval(id);
  }, [hearts.nextHeartAt]);

  const cost = hearts.refillCost ?? 0;
  const canAfford = sparks >= cost;

  return (
    <Animated.View entering={FadeIn.duration(200)} style={[StyleSheet.absoluteFill, styles.overlay]}>
      <View style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: c.dangerSoft }]}>
          <Ionicons name="heart-dislike" size={40} color={c.danger} />
        </View>
        <AppText variant="h2" center>{t('heartsOutTitle')}</AppText>
        <AppText variant="body" color={c.textSecondary} center>{t('heartsOutBody')}</AppText>

        {left ? (
          <AppText variant="bodyStrong" color={c.textSecondary} center>
            {tf('heartsNextIn', { time: left })}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <Button
            label={tf('heartsRefillCta', { n: cost })}
            icon="sparkles"
            onPress={onRefill}
            loading={refilling}
            disabled={!canAfford || refilling}
          />
          {!canAfford ? (
            <AppText variant="caption" color={c.danger} center>
              {tf('heartsNotEnough', { have: sparks, need: cost })}
            </AppText>
          ) : null}
          <Button label={t('heartsQuit')} variant="ghost" onPress={onQuit} />
        </View>
      </View>
    </Animated.View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    overlay: {
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      zIndex: 20,
    },
    card: { alignItems: 'center', gap: spacing.md, maxWidth: 400, width: '100%' },
    iconWrap: {
      width: 80, height: 80, borderRadius: radius.full,
      alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
    },
    actions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.md },
  });
