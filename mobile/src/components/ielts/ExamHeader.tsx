import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { useColors } from '../../settings/SettingsContext';
import { formatTime } from '../audio/SeekBar';
import { t, tf } from '../../i18n';
import { spacing, radius, type AppColors } from '../../theme/theme';

/**
 * Top strip of the exam player: leave, what test this is, the clock, and how
 * much of the answer sheet is filled.
 *
 * The clock counts UP against an advisory budget rather than down to zero. A
 * countdown that submits for you belongs in a real exam; this is practice, and
 * a student who runs out mid-question would just lose the work. So the number
 * turns amber past the budget and nothing else happens — the pressure is
 * visible, never enforced.
 */
export function ExamHeader({
  title,
  answered,
  total,
  budgetSeconds,
  onExit,
}: {
  title: string;
  answered: number;
  total: number;
  budgetSeconds: number;
  onExit: () => void;
}) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const elapsed = useElapsedSeconds();
  const over = elapsed > budgetSeconds;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable onPress={onExit} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={22} color={c.text} />
        </Pressable>

        <View style={styles.titleCol}>
          <AppText variant="bodyStrong" numberOfLines={1}>{title}</AppText>
          <AppText variant="caption" color={c.textMuted}>
            {tf('ieltsAnsweredOf', { n: answered, total })}
          </AppText>
        </View>

        <View style={[styles.chip, over && { backgroundColor: c.dangerSoft }]}>
          <Ionicons
            name={over ? 'alert-circle-outline' : 'time-outline'}
            size={14}
            color={over ? c.danger : c.textMuted}
          />
          <AppText variant="caption" color={over ? c.danger : c.textSecondary}>
            {formatTime(elapsed)}
          </AppText>
        </View>
      </View>

      {/* Answer-sheet fill. Deliberately not a score — nothing is graded until
          the whole set is submitted. */}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${total > 0 ? (answered / total) * 100 : 0}%` },
          ]}
        />
      </View>

      {over ? (
        <AppText variant="caption" color={c.danger} style={styles.overNote}>
          {t('ieltsOverTime')}
        </AppText>
      ) : null}
    </View>
  );
}

/** Seconds since the screen mounted, ticking once a second. */
function useElapsedSeconds(): number {
  const startedAt = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  return elapsed;
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    wrap: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
      backgroundColor: c.surface,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    close: { padding: 2 },
    titleCol: { flex: 1, gap: 1 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.full,
      backgroundColor: c.surfaceAlt,
    },
    track: { height: 4, borderRadius: radius.full, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
    fill: { height: 4, borderRadius: radius.full, backgroundColor: c.primary },
    overNote: { textAlign: 'right' },
  });
