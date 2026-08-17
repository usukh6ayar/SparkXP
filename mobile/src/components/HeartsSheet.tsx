import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { Button } from './Button';
import { ActionButton } from './ActionButton';
import { HeartsRow } from './HeartsRow';
import { AppIcon } from './AppIcon';
import { SheetModal } from './SheetModal';
import { useColors } from '../settings/SettingsContext';
import { useAuth } from '../auth/AuthContext';
import { useCountdown } from '../lib/countdown';
import { refillHearts, type HeartsState } from '../api/hearts';
import { t, tf } from '../i18n';
import { spacing, radius, type AppColors } from '../theme/theme';

/**
 * Hearts status + refill.
 *
 * One sheet serves two moments, because they need to say the same things — how
 * many are left, when the next one arrives, what a refill costs:
 *
 * - **Out of hearts** (`hearts === 0`): blocking. The backend keeps grading at
 *   zero, so a dialog you could tap past would make the limit cosmetic. The
 *   student refills or leaves the quiz.
 * - **Tapped for info** (any other time): dismissable, and there is nothing to
 *   leave — so the exit button becomes a plain "close".
 */
export function HeartsSheet({
  visible,
  state,
  sparksBalance,
  onRefilled,
  onClose,
  onExit,
  onRegen,
}: {
  visible: boolean;
  state: HeartsState | null;
  /** Sparks the student holds — decides whether refill is affordable. */
  sparksBalance: number;
  /** Refilled successfully → caller resumes with the new state. */
  onRefilled: (next: HeartsState) => void;
  /** Dismiss without doing anything (info mode). */
  onClose: () => void;
  /**
   * Give up on the current quiz. Only meaningful when out of hearts; without
   * it the sheet is purely informational and shows a "close" button instead.
   */
  onExit?: () => void;
  /** A heart regenerated while the sheet was open — refetch. */
  onRegen?: () => void;
}) {
  const c = useColors();
  const { token } = useAuth();
  const styles = useMemo(() => makeStyles(c), [c]);
  const timer = useCountdown(state?.nextHeartAt ?? null, onRegen);

  if (!state) return null;

  const empty = !state.unlimited && state.hearts <= 0;
  const blocking = empty && !!onExit;
  const full = state.unlimited || state.hearts >= state.max;
  const cost = state.refillCost ?? 0;
  const canAfford = sparksBalance >= cost;

  return (
    <SheetModal visible={visible} onClose={onClose} dismissable={!blocking}>
      <View style={[styles.iconWrap, empty && styles.iconWrapEmpty]}>
        <Ionicons
          name={empty ? 'heart-dislike' : 'heart'}
          size={38}
          color={empty ? c.danger : c.danger}
        />
      </View>

      <AppText variant="h2" center style={styles.title}>
        {empty ? t('heartsEmptyTitle') : t('heartsInfoTitle')}
      </AppText>

      <View style={styles.heartsWrap}>
        <HeartsRow state={state} size={26} />
      </View>

      <AppText variant="body" color={c.textSecondary} center style={styles.body}>
        {state.unlimited
          ? t('heartsUnlimitedBody')
          : empty
            ? timer
              ? tf('heartsEmptyBodyTimer', { time: timer })
              : t('heartsEmptyBody')
            : full
              ? t('heartsFullBody')
              : tf('heartsInfoBody', {
                  n: state.hearts,
                  max: state.max,
                  time: timer || '—',
                })}
      </AppText>

      {/* When the next heart is not the whole story, say when they are ALL back
          — that is what decides whether it is worth waiting. */}
      {!state.unlimited && !full && state.fullAt ? (
        <FullAtLine iso={state.fullAt} colors={c} />
      ) : null}

      {!full ? (
        <>
          <View style={styles.balance}>
            <AppIcon name="sparks" size={18} />
            <AppText variant="caption" color={c.textSecondary}>
              {tf('heartsBalance', { n: sparksBalance })}
            </AppText>
          </View>

          {/* The backend's 400s ("Sparks хүрэлцэхгүй байна") are already
              Mongolian and more specific than anything we could say, so the
              default alert (which shows exactly that) is right here. */}
          <ActionButton
            label={tf('heartsRefillCta', { n: cost })}
            action={() => refillHearts(token!)}
            onSuccess={onRefilled}
            disabled={!canAfford || !token}
            style={styles.refillBtn}
          />
        </>
      ) : null}

      <Button
        label={blocking ? t('heartsLeaveForNow') : t('close')}
        variant="ghost"
        onPress={blocking ? onExit : onClose}
        style={styles.exitBtn}
      />
    </SheetModal>
  );
}

/** "All hearts back by 18:40" — a separate countdown from the next-heart one. */
function FullAtLine({ iso, colors: c }: { iso: string; colors: AppColors }) {
  const full = useCountdown(iso);
  if (!full) return null;
  return (
    <AppText variant="caption" color={c.textMuted} center style={fullAtStyle.line}>
      {tf('heartsFullIn', { time: full })}
    </AppText>
  );
}

const fullAtStyle = StyleSheet.create({
  line: { marginBottom: spacing.md },
});

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    iconWrap: {
      alignSelf: 'center',
      width: 76,
      height: 76,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    iconWrapEmpty: { backgroundColor: c.dangerSoft },
    title: { marginBottom: spacing.sm },
    heartsWrap: { alignItems: 'center', marginBottom: spacing.sm },
    body: { marginBottom: spacing.md },
    balance: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    refillBtn: { marginTop: spacing.lg },
    exitBtn: { marginTop: spacing.sm },
  });
