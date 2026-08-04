import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { AppIcon } from './AppIcon';
import { SheetModal } from './SheetModal';
import { useColors } from '../settings/SettingsContext';
import { useAuth } from '../auth/AuthContext';
import { haptics } from '../lib/haptics';
import { alertError } from '../lib/alerts';
import {
  buyStreakFreeze,
  STREAK_FREEZE_FALLBACK,
  type Gamification,
} from '../api/gamification';
import { ApiError } from '../api/client';
import { t, tf } from '../i18n';
import { spacing, radius } from '../theme/theme';

/**
 * Buy a streak freeze with Sparks.
 *
 * A freeze covers one missed day so a long streak survives a bad week — losing
 * a streak is the single biggest reason learners quit, and this also gives
 * Sparks something worth spending on.
 */
export function StreakFreezeSheet({
  visible,
  gam,
  sparksBalance,
  onClose,
  onBought,
}: {
  visible: boolean;
  gam: Gamification | null;
  /** Sparks the student holds — decides whether the purchase is affordable. */
  sparksBalance: number;
  onClose: () => void;
  onBought: (next: Gamification) => void;
}) {
  const c = useColors();
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);

  const held = gam?.streakFreezes ?? 0;
  /** Missed days this streak has already survived. 0 when the API omits it. */
  const used = gam?.streakFreezesUsed ?? 0;
  const cost = gam?.streakFreezeCost ?? STREAK_FREEZE_FALLBACK.cost;
  const max = gam?.maxStreakFreezes ?? STREAK_FREEZE_FALLBACK.max;
  const atCap = held >= max;
  const canAfford = sparksBalance >= cost;

  async function buy() {
    if (!token || busy) return;
    setBusy(true);
    try {
      const next = await buyStreakFreeze(token);
      haptics.success();
      onBought(next);
    } catch (e) {
      alertError(e instanceof ApiError ? e.message : t('errorFallback'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetModal visible={visible} onClose={onClose}>
      <View style={[styles.iconWrap, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="snow" size={38} color={c.sparks} />
      </View>

      <AppText variant="h2" center style={styles.title}>
        {t('streakFreezeTitle')}
      </AppText>
      <AppText variant="body" color={c.textSecondary} center style={styles.body}>
        {t('streakFreezeBody')}
      </AppText>

      {/* How many are banked — the number that decides whether buying is even
          possible, so it gets its own line rather than hiding in the button.
          Restated in DAYS underneath, because "2 freezes" only means something
          once you know each one buys you one missed day. */}
      <View style={[styles.heldBox, { backgroundColor: c.surfaceAlt }]}>
        <Ionicons name="snow-outline" size={20} color={c.sparks} />
        <View>
          <AppText variant="bodyStrong" color={c.text}>
            {tf('streakFreezeHeld', { held, max })}
          </AppText>
          <AppText variant="caption" color={c.textSecondary}>
            {held > 0 ? tf('streakFreezeCoverNote', { n: held }) : t('streakFreezeNone')}
          </AppText>
        </View>
      </View>

      {/* What the freezes have actually done for this streak. Only rendered
          when the server reports it — see `streakFreezesUsed`. */}
      {used > 0 ? (
        <View style={styles.usedRow}>
          <Ionicons name="snow" size={16} color={c.sparks} />
          <AppText variant="caption" color={c.textSecondary}>
            {tf('streakFreezeUsedNote', { n: used })}
          </AppText>
        </View>
      ) : null}

      <View style={styles.balance}>
        <AppIcon name="sparks" size={18} />
        <AppText variant="caption" color={c.textSecondary}>
          {tf('heartsBalance', { n: sparksBalance })}
        </AppText>
      </View>

      <Button
        label={atCap ? t('streakFreezeAtCap') : tf('streakFreezeBuyCta', { n: cost })}
        onPress={buy}
        disabled={atCap || !canAfford || busy || !token}
        loading={busy}
        style={styles.buyBtn}
      />
      <Button
        label={t('close')}
        variant="ghost"
        onPress={onClose}
        style={styles.closeBtn}
      />
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignSelf: 'center',
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: { marginBottom: 4 },
  body: { marginBottom: spacing.md },
  heldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  usedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  buyBtn: { marginTop: spacing.lg },
  closeBtn: { marginTop: spacing.sm },
});
