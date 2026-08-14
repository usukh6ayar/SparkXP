import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { spacing, radius } from '../theme/theme';

type Tone = 'info' | 'warning';

/**
 * A calm inline message: something to notice, not something that went wrong.
 *
 * The distinction matters more than it sounds. "You have 3 questions left" and
 * "the request failed" are different events, and showing both as a red **Алдаа**
 * dialog teaches students to read every message as a mistake they made — which
 * is exactly the wrong feeling in the middle of a test they are still filling
 * in. A notice sits in the page, keeps its colour soft, and offers the next
 * step instead of an OK button that only dismisses.
 */
export function Notice({
  tone = 'info',
  icon,
  title,
  text,
  action,
}: {
  tone?: Tone;
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  text: string;
  /** Optional next step — "take me to the first one I skipped". */
  action?: { label: string; onPress: () => void };
}) {
  const c = useColors();
  const warning = tone === 'warning';
  const accent = warning ? c.warning : c.primary;

  return (
    <View style={[styles.wrap, { backgroundColor: warning ? c.warningSoft : c.primarySoft }]}>
      <Ionicons
        name={icon ?? (warning ? 'alert-circle-outline' : 'information-circle-outline')}
        size={20}
        color={accent}
      />
      <View style={styles.body}>
        {title ? <AppText variant="bodyStrong" color={c.text}>{title}</AppText> : null}
        <AppText variant="caption" color={c.textSecondary}>{text}</AppText>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={6} style={styles.action}>
            <AppText variant="caption" color={accent} style={styles.actionText}>
              {action.label}
            </AppText>
            <Ionicons name="arrow-forward" size={13} color={accent} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// Colour is applied inline (it flips with the tone), so the layout is static.
const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  body: { flex: 1, gap: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  actionText: { fontWeight: '700' },
});
