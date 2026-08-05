import { type ReactNode } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../Text';
import { OnboardingHeader } from './OnboardingHeader';
import { useColors } from '../../settings/SettingsContext';
import { spacing } from '../../theme/theme';
import { bounded } from '../../theme/responsive';

/**
 * The shell every onboarding step is built from: safe area, back + progress
 * header, a scrolling body, and a footer that stays pinned to the bottom.
 *
 * It is NOT `<Screen>` because that puts the whole screen (footer included)
 * inside one ScrollView — on a small phone the primary CTA would then sit below
 * the fold, which is the one thing a first-run flow cannot afford. Here only
 * the body scrolls, so "Үргэлжлүүлэх" is always within thumb reach.
 */
export function OnboardingStep({
  step,
  total,
  onBack,
  title,
  subtitle,
  children,
  footer,
}: {
  step?: number;
  total?: number;
  onBack?: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const c = useColors();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top', 'bottom']}>
      <View style={[styles.inner, bounded]}>
        <OnboardingHeader step={step} total={total} onBack={onBack} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {title ? (
            <View style={styles.head}>
              <AppText variant="h1">{title}</AppText>
              {subtitle ? (
                <AppText variant="body" color={c.textSecondary}>
                  {subtitle}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {children}
        </ScrollView>

        {footer}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  scroll: { flex: 1 },
  body: { paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.lg },
  head: { gap: spacing.sm },
});
