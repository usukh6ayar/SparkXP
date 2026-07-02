import { useRef, useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { t } from '../../src/i18n';
import { AppText } from '../../src/components/Text';
import { Button } from '../../src/components/Button';
import { MascotCircle } from '../../src/components/MascotCircle';
import { spacing, radius, elevation, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

const fox = require('../../assets/logo.webp');

interface Slide {
  title: string;
  body: string;
  gradient?: boolean;
  decor: (colors: AppColors) => React.ReactNode;
}

// A small floating chip/badge used to decorate the mascot circle.
function Badge({
  style,
  bg,
  children,
}: {
  style: object;
  bg?: string;
  children: React.ReactNode;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={[styles.badge, { backgroundColor: bg ?? colors.surface }, style]}>{children}</View>;
}

const SLIDES: Slide[] = [
  {
    title: t('onb1Title'),
    body: t('onb1Body'),
    decor: (colors: AppColors) => (
      <>
        <Badge style={{ top: 36, right: 12 }} bg={colors.primary}>
          <AppText variant="label" color={colors.white}>
            Hi!
          </AppText>
        </Badge>
        <Ionicons
          name="sparkles"
          size={22}
          color={colors.primary}
          style={{ position: 'absolute', bottom: 40, left: 6 }}
        />
        <Ionicons
          name="sparkles"
          size={16}
          color={colors.primaryDark}
          style={{ position: 'absolute', top: 24, left: 30 }}
        />
      </>
    ),
  },
  {
    title: t('onb2Title'),
    body: t('onb2Body'),
    gradient: true,
    decor: (colors: AppColors) => (
      <>
        <Badge style={{ top: 24, right: 18 }} bg={colors.primaryDark}>
          <AppText variant="label" color={colors.white}>
            XP
          </AppText>
        </Badge>
        <Badge style={{ top: 30, left: 14 }} bg={colors.xp}>
          <Ionicons name="trophy" size={18} color={colors.white} />
        </Badge>
        <Badge style={{ bottom: 36, right: 22 }} bg={colors.sparks}>
          <Ionicons name="diamond" size={16} color={colors.white} />
        </Badge>
      </>
    ),
  },
  {
    title: t('onb3Title'),
    body: t('onb3Body'),
    decor: (colors: AppColors) => (
      <>
        <Badge style={{ top: 28, left: 10 }} bg={colors.primary}>
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.white} />
        </Badge>
        <Badge style={{ bottom: 44, right: 0 }}>
          <AppText variant="caption" color={colors.text}>
            Great job! 👍
          </AppText>
        </Badge>
        <Badge style={{ bottom: 28, left: 18 }} bg={colors.surface}>
          <Ionicons name="laptop-outline" size={18} color={colors.primary} />
        </Badge>
      </>
    ),
  },
];

export default function OnboardingScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable style={styles.skip} onPress={finish} hitSlop={8}>
        <AppText variant="bodyStrong" color={colors.textSecondary}>
          {t('skip')}
        </AppText>
      </Pressable>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.flex}
      >
        {SLIDES.map((s) => (
          <View key={s.title} style={[styles.slide, { width }]}>
            <MascotCircle image={fox} gradient={s.gradient}>
              {s.decor(colors)}
            </MascotCircle>
            <AppText variant="h1" center style={styles.title}>
              {s.title}
            </AppText>
            <AppText variant="body" center color={colors.textSecondary}>
              {s.body}
            </AppText>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <Button label={last ? t('onbStart') : t('onbNext')} onPress={onNext} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  skip: { alignSelf: 'flex-end', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  title: { marginTop: spacing.sm },
  badge: {
    position: 'absolute',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 34,
    minHeight: 34,
    ...(elevation.sm as object),
  },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: { width: 22, backgroundColor: colors.primary },
});
