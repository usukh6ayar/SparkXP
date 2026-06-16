import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { AppText } from './Text';
import { IconTile } from './IconTile';
import { Pill } from './Pill';
import { t } from '../i18n';
import { colors, spacing, tints } from '../theme/theme';

/** A class row in the teacher's class list: name, join code, student count. */
export function ClassCard({
  name,
  joinCode,
  studentCount,
  onPress,
}: {
  name: string;
  joinCode: string;
  studentCount?: number;
  onPress: () => void;
}) {
  return (
    <Card variant="raised" onPress={onPress} style={styles.card}>
      <IconTile icon="people" bg={tints.purple.bg} fg={tints.purple.fg} size={48} />
      <View style={styles.body}>
        <AppText variant="h3" numberOfLines={1}>
          {name}
        </AppText>
        <View style={styles.meta}>
          <Pill label={joinCode} icon="key" bg={tints.amber.bg} fg={tints.amber.fg} />
          {studentCount != null ? (
            <AppText variant="caption">
              {studentCount} {t('studentCount')}
            </AppText>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  body: { flex: 1, gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
