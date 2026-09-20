import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AppImage } from './AppImage';
import { useSettings } from '../settings/SettingsContext';

/**
 * The bundled library the buddy stands in — one per theme, same camera and
 * composition so switching theme re-lights the room rather than moving it.
 * Both are portrait and built with depth: blurred foreground, the rug the buddy
 * stands on in the middle, window and shelves behind.
 */
const ROOM = {
  light: require('../../assets/buddy-room-light.webp'), // daylight
  dark: require('../../assets/buddy-room-dark.webp'),   // evening, warm lamps
};

/**
 * Scrim stops, top → bottom. It is a GRADIENT, not a flat wash, because the two
 * jobs are in different places: the header needs the top darkened and the mic
 * controls need the bottom darkened, while the middle — the buddy's face — must
 * stay as clear as the artist drew it. A flat scrim heavy enough for the
 * controls turned the whole room to mud.
 *
 * The daylight room starts brighter, so it takes more at both ends.
 */
const SCRIM = {
  light: ['rgba(10,6,26,0.46)', 'rgba(10,6,26,0.16)', 'rgba(10,6,26,0.18)', 'rgba(10,6,26,0.66)'],
  dark: ['rgba(10,6,26,0.34)', 'rgba(10,6,26,0.06)', 'rgba(10,6,26,0.10)', 'rgba(10,6,26,0.56)'],
} as const;

/** Where each scrim stop sits: top edge, below the header, above the mic, bottom. */
const SCRIM_STOPS = [0, 0.22, 0.58, 1] as const;

/**
 * Full-bleed scene behind the buddy screen: the equipped shop background when
 * the student owns one, else the bundled library for the active theme.
 *
 * It is a SCREEN layer, not a stage layer — it sits behind the header and runs
 * under the status bar, so the art is the whole screen. Drawn inside the stage
 * instead, it stopped at the header and left a bar of flat themed colour above
 * the room.
 *
 * Text drawn straight on this art takes `textOnDark` (never `textOnDarkMuted`,
 * which the theme reserves for a ≥60% scrim).
 */
export function BuddyBackdrop({ url }: { url?: string | null }) {
  const { theme } = useSettings();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <AppImage
        source={url ?? ROOM[theme]}
        // The room is 941px wide; asking for more would only upscale. Remote
        // shop art is capped here too, so neither path downloads a master.
        width={941}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // The room is bundled, so it decodes instantly and a fade would read as
        // a flash on every mount. Shop art crossfades because it is a download.
        transition={url ? 200 : 0}
      />
      <LinearGradient
        colors={SCRIM[theme]}
        locations={SCRIM_STOPS}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
