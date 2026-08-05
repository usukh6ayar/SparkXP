import { useEffect, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Scrim, SparkleLayer, useKenBurns } from './primitives';
import { SCENES, SCENE_ORDER, type SceneKey } from './palette';

const SCENE_INDEX_KEY = 'sparkxp.celebrationScene';

/** Sparkle confetti tuned to the art — gold leads, because gold reads as reward. */
const SPARKLES = ['#FFC93C', '#C4AEFF', '#4FC3F7', '#FF7BA9', '#6EE7B7'] as const;

/**
 * Picks the next world in the rotation and remembers where it got to.
 *
 * Deliberately a CYCLE, not a random pick: with four scenes, random repeats
 * about a quarter of the time, and seeing the same world twice running is
 * exactly what makes a celebration feel canned. Cycling guarantees four
 * different worlds before any of them comes back.
 */
export function useCelebrationScene(): SceneKey | null {
  const [scene, setScene] = useState<SceneKey | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      let next = 0;
      try {
        const raw = await AsyncStorage.getItem(SCENE_INDEX_KEY);
        next = (Number(raw ?? -1) + 1) % SCENE_ORDER.length;
        if (!Number.isFinite(next) || next < 0) next = 0;
      } catch {
        // Storage is a nicety here — a failed read just restarts the cycle.
      }
      if (!alive) return;
      setScene(SCENE_ORDER[next]);
      AsyncStorage.setItem(SCENE_INDEX_KEY, String(next)).catch(() => {});
    })();
    return () => { alive = false; };
  }, []);

  return scene;
}

/**
 * The full-bleed celebration artwork: one of the four commissioned SparkXP
 * plates, a slow push-in, a readability wash, and a shimmer over the sky.
 *
 * Pass a `scene` to pin one (the design gallery does); omit it and the
 * component takes the next one in the rotation itself.
 */
export function CelebrationBackground({
  scene,
  style,
  /** Off for small tiles in the gallery, where twelve of them would thrash. */
  animated = true,
}: {
  scene?: SceneKey;
  style?: ViewStyle;
  animated?: boolean;
}) {
  const rotating = useCelebrationScene();
  const active = scene ?? rotating;
  const kenBurns = useKenBurns();

  // Deep violet under everything: the art fades in, and a white flash before it
  // would undo the whole mood.
  if (!active) return <View style={[StyleSheet.absoluteFill, styles.base, style]} />;

  const art = SCENES[active];

  return (
    <Animated.View
      // Remount on scene change so a pinned preview cross-fades cleanly.
      key={active}
      entering={FadeIn.duration(320)}
      style={[StyleSheet.absoluteFill, styles.base, style]}
      pointerEvents="none"
    >
      <Animated.View style={[StyleSheet.absoluteFill, animated && kenBurns]}>
        <Image
          source={art.art}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          // The plates are the same four every time — keep them decoded.
          cachePolicy="memory-disk"
          transition={0}
        />
      </Animated.View>

      <Scrim strength={art.scrim} />

      {animated ? (
        <>
          <SparkleLayer seed={5} count={9} size={9} duration={2400} delay={0} colors={SPARKLES} />
          <SparkleLayer seed={23} count={7} size={7} duration={3200} delay={700} drift={22} colors={SPARKLES} />
          <SparkleLayer seed={61} count={5} size={12} duration={4000} delay={1500} drift={10} colors={SPARKLES} />
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#0B0730', overflow: 'hidden' },
});
