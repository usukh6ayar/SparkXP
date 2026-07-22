import { View, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { radius, spacing, type AppColors } from '../theme/theme';
import { t } from '../i18n';

export type SkillKey = 'listening' | 'reading' | 'writing' | 'fill' | 'vocab';

export interface SkillRow {
  key: SkillKey;
  value: number | null;
}

/**
 * A labelled horizontal bar per skill. `null` value renders an empty track and
 * "—" instead of 0% (so "no data" reads differently from a real zero score).
 */
export function SkillBars({ rows }: { rows: SkillRow[] }) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <AppText variant="label" style={styles.label}>{t(`skill_${r.key}`)}</AppText>
          <View style={styles.track}>
            {r.value != null && <View style={[styles.fill, { width: `${r.value}%` }]} />}
          </View>
          <AppText variant="label" style={styles.val}>
            {r.value == null ? '—' : `${r.value}%`}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: AppColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    label: { width: 68 },
    track: {
      flex: 1,
      height: 8,
      borderRadius: radius.full,
      backgroundColor: colors.border,
      overflow: 'hidden',
    },
    fill: { height: 8, borderRadius: radius.full, backgroundColor: colors.primary },
    val: { width: 44, textAlign: 'right' },
  });
