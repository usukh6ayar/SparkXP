import { View, StyleSheet } from 'react-native';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { radius, spacing, type AppColors } from '../theme/theme';
import { t } from '../i18n';
import type { SubmissionStatus } from '../api/teacher';

/** Maps a submission status to a theme color token. */
const COLOR_KEY: Record<SubmissionStatus, keyof AppColors> = {
  assigned: 'textMuted',
  completed: 'success',
  late: 'danger',
};

/** Small pill showing an assignment submission's state (Хийгээгүй/Хийсэн/Хоцорсон). */
export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const colors = useColors();
  const styles = makeStyles();
  const c = colors[COLOR_KEY[status]] as string;
  return (
    <View style={[styles.pill, { backgroundColor: c + '22' }]}>
      <AppText variant="label" color={c}>{t(`submissionStatus_${status}`)}</AppText>
    </View>
  );
}

const makeStyles = () =>
  StyleSheet.create({
    pill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.full,
    },
  });
