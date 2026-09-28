import { Animated, StyleSheet } from 'react-native';

/**
 * Candy-Crush-style level map: one tall painted world that scrolls WITH the
 * lesson trail, so climbing the trail climbs the world — forest floor at the
 * first lesson, the level's landmark island at the last.
 *
 * The art is taller than the screen but usually shorter than the trail, so it
 * moves at its own (parallax) speed: the whole scroll range of the trail maps
 * onto the whole art — bottom of the trail shows the bottom of the art, top of
 * the trail shows the top. That works for any number of lessons.
 *
 * Each map is 3 sections painted separately and stitched offline with a cloud
 * crossfade at the seams (see ROADMAP → "Хичээлийн газрын зураг").
 */

export type MapArt = { src: number; aspect: number }; // aspect = height / width

const LEVEL_ASPECT = 4248 / 1024; // every level map = 3 stitched 1024×1536 sections

/** Levels that have map art. Levels without one keep the old fixed backdrop. */
export const LEVEL_MAPS: Partial<Record<string, { light: MapArt; dark: MapArt }>> = {
  a1: {
    light: { src: require('../../assets/levels/a1-light.webp'), aspect: LEVEL_ASPECT },
    dark: { src: require('../../assets/levels/a1-dark.webp'), aspect: LEVEL_ASPECT },
  },
  a2: {
    light: { src: require('../../assets/levels/a2-light.webp'), aspect: LEVEL_ASPECT },
    dark: { src: require('../../assets/levels/a2-dark.webp'), aspect: LEVEL_ASPECT },
  },
  b1: {
    light: { src: require('../../assets/levels/b1-light.webp'), aspect: LEVEL_ASPECT },
    dark: { src: require('../../assets/levels/b1-dark.webp'), aspect: LEVEL_ASPECT },
  },
  b2: {
    light: { src: require('../../assets/levels/b2-light.webp'), aspect: LEVEL_ASPECT },
    dark: { src: require('../../assets/levels/b2-dark.webp'), aspect: LEVEL_ASPECT },
  },
  c1: {
    light: { src: require('../../assets/levels/c1-light.webp'), aspect: LEVEL_ASPECT },
    dark: { src: require('../../assets/levels/c1-dark.webp'), aspect: LEVEL_ASPECT },
  },
  c2: {
    light: { src: require('../../assets/levels/c2-light.webp'), aspect: LEVEL_ASPECT },
    dark: { src: require('../../assets/levels/c2-dark.webp'), aspect: LEVEL_ASPECT },
  },
};

/** The Lessons tab's world map (A1 forest → C2 sky palace), day and night. */
export const WORLD_MAP: { light?: MapArt; dark?: MapArt } = {
  light: { src: require('../../assets/levels/world-light.webp'), aspect: 5020 / 1024 },
  dark: { src: require('../../assets/levels/world-dark.webp'), aspect: 5020 / 1024 },
};

type Props = {
  art: MapArt;
  width: number;
  /** Height of the area the art covers (the art's top/bottom meet its edges). */
  viewportH: number;
  /** The scroll view's full scroll range (content height − its own height). */
  maxScroll: number;
  /** The scroll view's contentOffset.y, driven natively. */
  scrollY: Animated.Value;
};

export function LevelMapBackdrop({ art, width, viewportH, maxScroll, scrollY }: Props) {
  const artH = width * art.aspect;
  const travel = Math.max(0, artH - viewportH); // how far the art can move

  // Trail too short to scroll: show the bottom of the world (where it begins).
  const translateY =
    maxScroll > 0
      ? scrollY.interpolate({
          inputRange: [0, maxScroll],
          outputRange: [0, -travel],
          extrapolate: 'clamp',
        })
      : -travel;

  return (
    <Animated.Image
      source={art.src}
      resizeMode="cover"
      style={[styles.art, { width, height: artH, transform: [{ translateY }] }]}
    />
  );
}

const styles = StyleSheet.create({
  art: { position: 'absolute', top: 0, left: 0 },
});
