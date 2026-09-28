import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSettings } from '../settings/SettingsContext';

/**
 * The desk the buddy sits behind, like a news anchor.
 *
 * The character is a BUST — the art stops at the chest, with no arms — and
 * that cut used to be hidden under a blur band, whose own top edge drew a hard
 * line across the hoodie. A desk in the foreground hides the cut the way a real
 * scene would, so nothing has to be blurred at all.
 *
 * Painted art per theme (daylight / evening library), placed so the tabletop's
 * BACK edge lands on `SHADOW_H`: the props (books, plant, mug, lamp) stand up
 * past the top of this view, over the room, which is what sells the desk as a
 * thing in the scene.
 *
 * The desk front runs off the bottom of the screen, behind the mic and the
 * type bar. The art is cut just above its bottom rail, and a few-pixel strip of
 * its last rows (`tail`: side stiles + inner panel) is STRETCHED down to fill
 * the rest — so the front simply continues, with no flat fill or fade (both
 * read as "the desk ends here and something blurry starts").
 */

const ART = {
  light: {
    src: require('../../assets/buddy-desk-light.webp'),
    tail: require('../../assets/buddy-desk-light-tail.webp'),
    aspect: 0.7209, // art height / width
    backFrac: 0.2135, // tabletop back edge, as a share of the art height
  },
  dark: {
    src: require('../../assets/buddy-desk-dark.webp'),
    tail: require('../../assets/buddy-desk-dark-tail.webp'),
    aspect: 0.7767,
    backFrac: 0.2782,
  },
} as const;

/** Contact shadow height above the tabletop's back edge — puts the buddy BEHIND the desk. */
const SHADOW_H = 34;

type Props = {
  width: number;
  height: number;
  style?: ViewStyle;
};

export function BuddyDesk({ width: W, height: H, style }: Props) {
  const { theme } = useSettings();
  const art = ART[theme];
  const artH = Math.round(W * art.aspect);
  const artTop = Math.round(SHADOW_H - art.backFrac * artH);
  const artBottom = artTop + artH;

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      {/* Contact shadow on the buddy, just above the back edge. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.5)']}
        style={[styles.band, { top: 0, height: SHADOW_H + 2 }]}
      />
      {/* Desk front continued below the art. Overlaps the art by 1px so no
          hairline of background shows at the join. */}
      <Image
        source={art.tail}
        resizeMode="stretch"
        style={[styles.band, { top: artBottom - 1, height: Math.max(0, H - artBottom + 1) }]}
      />
      <Image source={art.src} style={{ position: 'absolute', left: 0, top: artTop, width: W, height: artH }} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0 },
});
