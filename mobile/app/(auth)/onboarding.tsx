import { useRef, useState, useMemo } from 'react';
import {
  View,
  Image,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { useColors } from '../../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../../src/theme/theme';

const BG = '#F4F2FC';

// Each slide is a full-screen background artwork (title + mascot + scene baked
// in). Navigation chrome (Skip / dots / CTA) is overlaid on top.
const SLIDES = [
  require('../../assets/onboarding/onboard1.png'),
  require('../../assets/onboarding/onboard2.png'),
  require('../../assets/onboarding/onboard3.png'),
];

export default function OnboardingScreen() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { completeOnboarding } = useAuth();
  const router = useRouter();
  const scroller = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  async function finish() {
    await completeOnboarding();
    router.replace('/(auth)/login');
  }

  function onNext() {
    if (last) return finish();
    scroller.current?.scrollTo({ x: width * (index + 1), animated: true });
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  }

  return (
    <View style={styles.root}>
      {/* Full-screen background artwork pager — all slides positioned alike. */}
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
      >
        {SLIDES.map((src, i) => (
          <Image key={i} source={src} style={{ width, height }} resizeMode="cover" />
        ))}
      </ScrollView>

      {/* Skip — top-right, frosted glass. */}
      <Pressable style={[styles.skip, { top: insets.top + spacing.sm }]} onPress={finish} hitSlop={8}>
        <BlurView intensity={30} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.skipTint]} />
        <AppText variant="bodyStrong" color={c.primary}>{t('skip')}</AppText>
      </Pressable>

      {/* Bottom controls — dots + frosted-glass CTA over the artwork. */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Pressable
          onPress={onNext}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          accessibilityRole="button"
          accessibilityLabel={last ? t('onbStart') : t('onbNext')}
        >
          <BlurView
            intensity={40}
            tint="light"
            experimentalBlurMethod="dimezisBlurView"
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.ctaTint]} />
          <View style={styles.ctaContent}>
            <AppText variant="bodyStrong" color={c.primary} style={styles.ctaLabel}>
              {t('onbStart')}
            </AppText>
            <Ionicons name={last ? 'checkmark' : 'arrow-forward'} size={20} color={c.primary} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: BG },

    // Frosted Skip pill.
    skip: {
      position: 'absolute',
      right: spacing.lg,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.full,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.7)',
    },
    skipTint: { backgroundColor: 'rgba(255,255,255,0.35)' },

    bottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(108,59,255,0.3)' },
    dotActive: { width: 22, backgroundColor: c.primary },

    // Frosted-glass CTA — real background blur clipped to the rounded shape.
    cta: {
      height: 56,
      borderRadius: radius.xl,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.85)',
    },
    ctaTint: { backgroundColor: 'rgba(255,255,255,0.3)' },
    ctaContent: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
    ctaLabel: { fontWeight: '700' },
  });
