import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '../Text';
import { PressableScale } from '../PressableScale';
import { useColors, useSettings } from '../../settings/SettingsContext';
import { spacing, radius, tintThemes, type AppColors, type Tints } from '../../theme/theme';
import { useMemo } from 'react';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * One selectable answer in the onboarding flow (goal · level · daily minutes).
 *
 * Selection is shown three ways at once — purple border, tinted fill and a
 * check — because a border alone is invisible to a colour-blind user and a
 * tint alone is invisible in bright sun. `accessibilityState.selected` carries
 * the same information to a screen reader.
 *
 * `badge` renders instead of the icon (the CEFR chip on the level step), so the
 * three choice screens share one row shape rather than each inventing its own.
 */
export function OnboardingOptionCard({
  title,
  subtitle,
  icon,
  badge,
  tint = 'purple',
  selected,
  onPress,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Short text chip shown in place of the icon (e.g. "B1"). */
  badge?: string;
  tint?: keyof Tints;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const tints = useTints();
  const styles = useMemo(() => makeStyles(c), [c]);
  const pair = tints[tint];

  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.98}
      style={[styles.card, selected && styles.cardOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      <View style={[styles.lead, { backgroundColor: selected ? c.primarySoft : pair.bg }]}>
        {badge ? (
          <AppText variant="label" color={selected ? c.primary : pair.fg}>
            {badge}
          </AppText>
        ) : (
          <Ionicons name={icon ?? 'ellipse-outline'} size={22} color={selected ? c.primary : pair.fg} />
        )}
      </View>

      <View style={styles.copy}>
        <AppText variant="bodyStrong" color={selected ? c.primary : c.text}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={c.textSecondary} style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {/* Reserves its slot whether or not it is filled, so picking an option
          never nudges the text sideways. */}
      <View style={styles.checkSlot}>
        {selected ? <Ionicons name="checkmark-circle" size={24} color={c.primary} /> : null}
      </View>
    </PressableScale>
  );
}

/** Tint pairs for the ACTIVE theme (the static export is dark-pinned). */
function useTints() {
  return tintThemes[useSettings().theme];
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      // 44pt minimum touch target, comfortably exceeded by the padded row.
      minHeight: 64,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 2,
      borderColor: c.border,
      backgroundColor: c.surface,
    },
    cardOn: { borderColor: c.primary, backgroundColor: c.primarySoft },
    lead: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    copy: { flex: 1, gap: 2 },
    subtitle: { lineHeight: 17 },
    checkSlot: { width: 24, alignItems: 'center' },
  });
