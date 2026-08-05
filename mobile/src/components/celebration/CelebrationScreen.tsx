import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '../Text';
import { Button } from '../Button';
import { PressableScale } from '../PressableScale';
import { Confetti } from '../Confetti';
import { CountUp } from '../CountUp';
import { CelebrationBackground } from './CelebrationBackground';
import { SCENES, type SceneKey } from './palette';
import { haptics } from '../../lib/haptics';
import { SPRING, enter, useReduceMotion } from '../../lib/motion';
import { colors, radius, spacing } from '../../theme/theme';
import { bounded, ms } from '../../theme/responsive';

type IconName = keyof typeof Ionicons.glyphMap;

/** One figure in the glass card (accuracy, time, streak, words…). */
export interface CelebrationStat {
  icon: IconName;
  label: string;
  value: string;
  /** Tint for the icon. Defaults to the scene's accent. */
  color?: string;
}

/**
 * The screen the student lands on the instant they finish ANYTHING — a lesson,
 * a quiz, speaking, listening, reading, writing, the daily challenge.
 *
 * One screen for all of them on purpose. Finishing should feel the same size
 * every time; a lesson that celebrates louder than a reading exercise quietly
 * tells the student which parts of the app matter. What changes between them is
 * the copy and the numbers — never the ceremony.
 *
 * **The layout follows the artwork.** All four plates put the fox mascot
 * through the middle of the frame, so the UI is anchored to the BOTTOM and the
 * art is left to be the hero — the way a game's victory screen shows the
 * character above and the rewards below. A card floated over the centre would
 * cover the one thing worth looking at.
 *
 * The world behind ROTATES through all four (see `CelebrationBackground`), so
 * the tenth completion still has something new in it.
 */
export function CelebrationScreen({
  visible,
  eyebrow,
  title,
  subtitle,
  xp,
  stats = [],
  primary,
  secondary,
  scene,
}: {
  visible: boolean;
  /** Small line above the title — what was finished ("ХИЧЭЭЛ ДУУСЛАА"). */
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** XP earned. Pass 0 or omit for a flow that pays nothing. */
  xp?: number;
  stats?: CelebrationStat[];
  primary: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  /** Pin a specific world instead of taking the next in the rotation. */
  scene?: SceneKey;
}) {
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();

  // The XP figure springs in oversized, settles, then its halo breathes — the
  // one thing on the screen that keeps moving while the student reads.
  const pop = useSharedValue(0);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (!visible) { pop.value = 0; halo.value = 0; return; }
    haptics.celebrate();
    pop.value = reduce ? 1 : withSequence(withSpring(1.14, SPRING), withSpring(1, SPRING));
    halo.value = reduce
      ? 0.5
      : withDelay(
          260,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
              withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
            ),
            -1,
            false,
          ),
        );
  }, [visible, reduce, pop, halo]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + halo.value * 0.45,
    transform: [{ scale: 1 + halo.value * 0.12 }],
  }));

  const showXp = (xp ?? 0) > 0;
  const accent = scene ? SCENES[scene].accent : colors.xp;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={primary.onPress} statusBarTranslucent>
      <View style={styles.root}>
        <CelebrationBackground scene={scene} />
        {visible ? <Confetti count={52} /> : null}

        {/* Bottom-anchored: the art owns the top two thirds. */}
        <View
          style={[
            styles.body,
            { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <View style={styles.spacer} />

          <View style={[styles.panel, bounded]}>
            <Animated.View
              entering={reduce ? undefined : FadeIn.delay(140).duration(420)}
              style={styles.headline}
            >
              <View style={[styles.eyebrowChip, { borderColor: `${accent}59` }]}>
                <Ionicons name="sparkles" size={13} color={accent} />
                <AppText variant="overline" color={colors.textOnDark}>{eyebrow}</AppText>
              </View>

              <AppText variant="display" color={colors.textOnDark} center style={styles.title}>
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="body" color={colors.textOnDarkMuted} center style={styles.subtitle}>
                  {subtitle}
                </AppText>
              ) : null}
            </Animated.View>

            {/* --- Reward card ------------------------------------------------ */}
            {showXp || stats.length > 0 ? (
              <Animated.View
                entering={reduce ? undefined : enter(280)}
                style={styles.glass}
              >
                {/* Real blur with a translucent fill under it: BlurView alone is
                    nearly invisible over dark art, and the fill alone is a grey
                    box. Together they read as frosted glass. */}
                <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.glassFill} />

                {showXp ? (
                  <View style={styles.xpRow}>
                    <Animated.View style={[styles.xpHalo, { backgroundColor: `${accent}2E` }, haloStyle]} />
                    <Animated.View style={[styles.xpInline, popStyle]}>
                      <Ionicons name="flash" size={ms(30)} color={accent} />
                      <CountUp
                        value={xp!}
                        prefix="+"
                        variant="display"
                        color={colors.textOnDark}
                        duration={900}
                        style={styles.xpNumber}
                      />
                      <AppText variant="h3" color={colors.textOnDarkMuted} style={styles.xpUnit}>XP</AppText>
                    </Animated.View>
                  </View>
                ) : null}

                {showXp && stats.length > 0 ? <View style={styles.hairline} /> : null}

                {stats.length > 0 ? (
                  <View style={styles.statRow}>
                    {stats.map((s, i) => (
                      <View key={s.label} style={[styles.stat, i > 0 && styles.statDivider]}>
                        <Ionicons name={s.icon} size={17} color={s.color ?? accent} />
                        <AppText variant="h3" color={colors.textOnDark}>{s.value}</AppText>
                        <AppText variant="caption" color={colors.textOnDarkMuted} numberOfLines={1}>
                          {s.label}
                        </AppText>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            ) : null}

            {/* --- Actions ---------------------------------------------------- */}
            <Animated.View
              entering={reduce ? undefined : enter(420)}
              style={styles.actions}
            >
              <Button label={primary.label} icon="arrow-forward" onPress={primary.onPress} />
              {secondary ? (
                // Not `<Button variant="ghost">`: that paints its label with the
                // ACTIVE theme's brand purple, which on the light theme is a dark
                // ink that vanishes against the artwork. Over a scene the label
                // must always be white.
                <PressableScale onPress={secondary.onPress} style={styles.secondaryBtn}>
                  <AppText variant="bodyStrong" color={colors.textOnDark}>{secondary.label}</AppText>
                </PressableScale>
              ) : null}
            </Animated.View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0730' },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  /** Everything above the panel is artwork. */
  spacer: { flex: 1 },
  panel: { alignSelf: 'center', width: '100%', gap: spacing.lg },

  headline: { alignItems: 'center', gap: spacing.sm },
  eyebrowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderWidth: 1,
  },
  title: { paddingHorizontal: spacing.sm },
  subtitle: { paddingHorizontal: spacing.md },

  // 32px corners — the premium radius, and the one surface in the app big
  // enough to carry it without looking like a bubble.
  glass: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  glassFill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.10)' },

  xpRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg },
  xpHalo: { position: 'absolute', width: ms(200), height: ms(64), borderRadius: radius.full },
  xpInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  xpNumber: { fontSize: ms(44), lineHeight: ms(50) },
  xpUnit: { marginTop: ms(8) },

  hairline: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginHorizontal: spacing.lg },

  statRow: { flexDirection: 'row', paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs },
  statDivider: { borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.16)' },

  actions: { gap: spacing.sm },
  secondaryBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});
