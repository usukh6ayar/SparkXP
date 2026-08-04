import { useWindowDimensions, StyleSheet, View } from 'react-native';
import Animated, {
  SlideInDown,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSettings } from '../settings/SettingsContext';
import { haptics } from '../lib/haptics';
import { SPRING, useReduceMotion } from '../lib/motion';
import { spacing } from '../theme/theme';
import type { AppIconName } from '../constants/appIcons';
import { WaveCard } from './tabbar/WaveCard';
import { TabItem } from './tabbar/TabItem';
import { BuddyTab } from './tabbar/BuddyTab';
import { BAR_H, BUDDY_SLOT, LABEL_BOTTOM, TOTAL_H, cardBottom } from './tabbar/geometry';

const buddy = require('../../assets/buddy-menu.webp');

/** The buddy's own route — rendered as the floating hero, not as a flat tab. */
const BUDDY_ROUTE = 'chat';

/**
 * Route → brand 3D icon (`src/constants/appIcons.ts`). Tab ORDER comes from
 * `app/(tabs)/_layout.tsx`, not here.
 */
const ICONS: Record<string, AppIconName> = {
  index: 'home',
  lessons: 'reading',
  soril: 'trophy',
  profile: 'profile',
};

/**
 * SparkXP's bottom navigation: a card whose top edge is one long wave, with the
 * AI buddy rising out of the crest as the primary call to action.
 *
 * Three files, one job each — the shape (`WaveCard`), a flat tab (`TabItem`),
 * the hero (`BuddyTab`); the numbers they share live in `tabbar/geometry.ts`.
 *
 * The root is an OVERLAY (`position: absolute`) and `box-none`. Both matter:
 *  - Absolute, because React Navigation lays the tab bar out as a sibling of
 *    the screens and hands them whatever height is left. In the flow, this
 *    view's transparent buddy band would eat ~40px of every screen for
 *    nothing. Out of the flow it costs zero, and `app/(tabs)/_layout.tsx` pads
 *    the screens by the solid card's height instead.
 *  - Taller than the card, because on Android a child drawn outside its parent
 *    renders but never receives touches — a buddy that "overflowed" upward
 *    would look right and be dead to the touch. It lives inside the box, and
 *    `box-none` lets taps on the transparent band reach the screen behind.
 *
 * In the row the buddy leaves a fixed-width gap behind, so the four flat tabs
 * space themselves around it.
 */
export function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useSettings();
  const reduce = useReduceMotion();

  const labels: Record<string, string> = {
    index: t('home'),
    lessons: t('tabLessons'),
    [BUDDY_ROUTE]: t('aiBuddyShort'),
    soril: t('quiz'),
    profile: t('profile'),
  };

  // Hidden routes (anything without a label) never reach the bar.
  const visible = state.routes.filter((r) => r.name in labels);

  // 0…1, pulsed on every tab change: the wave swells and settles.
  //
  // It used to LEAN instead — the whole card slid a few px toward the tab you
  // picked. That looked like the bar being dragged rather than answering, and
  // at the ends it slid a gap open against the opposite edge of the screen.
  // A swell has no such edge to expose.
  const splash = useSharedValue(0);

  /** Switch tabs, with a swell through the wave. */
  const select = (route: (typeof visible)[number]) => {
    const focused = state.index === state.routes.indexOf(route);
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (focused || event.defaultPrevented) return;
    haptics.select(); // tactile tick when switching tabs
    splash.value = withSequence(withTiming(1, { duration: 160 }), withSpring(0, SPRING));
    navigation.navigate(route.name);
  };

  const buddyRoute = visible.find((r) => r.name === BUDDY_ROUTE);
  // The strip of safe area the card sits on. Every band below measures from
  // the card's bottom edge, so they all read this one value.
  const bottom = cardBottom(insets.bottom);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.root, { height: TOTAL_H + bottom }]}
      entering={reduce ? undefined : SlideInDown.springify().damping(18).mass(0.7)}
    >
      <WaveCard width={width} bottomInset={bottom} splash={splash} />

      {/* Sits ON the card body and stops where the safe area begins, so the
          icons are optically centred in the bar instead of being pushed down
          against the home indicator. */}
      <View style={[styles.row, { bottom }]}>
        {visible.map((route) =>
          route.name === BUDDY_ROUTE ? (
            // The hero is positioned against the crest below, not in this row —
            // this only reserves its width.
            <View key={route.key} style={styles.buddySlot} />
          ) : (
            <TabItem
              key={route.key}
              icon={ICONS[route.name]}
              label={labels[route.name]}
              focused={state.index === state.routes.indexOf(route)}
              onPress={() => select(route)}
            />
          ),
        )}
      </View>

      {buddyRoute ? (
        <View
          pointerEvents="box-none"
          style={[
            styles.buddyAnchor,
            // Anchored by its LABEL, not by the avatar: the label lands on the
            // same baseline as the other four and the avatar stacks up from
            // there, leaving its head above the crest.
            { bottom: LABEL_BOTTOM + bottom },
          ]}
        >
          <BuddyTab
            image={buddy}
            label={labels[BUDDY_ROUTE]}
            focused={state.index === state.routes.indexOf(buddyRoute)}
            onPress={() => select(buddyRoute)}
          />
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /**
   * Out of the flow, pinned to the bottom — see the note on the component.
   * Screens keep their full height; `_layout.tsx` pads them by the card.
   */
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  /** The flat tabs, sitting on the card below the wave's shoulders. */
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_H,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    // Stretch, NOT centre: each tab fills the card's height and bottom-aligns
    // its own column, which is what puts all five labels on one line.
    alignItems: 'stretch',
  },
  buddySlot: { width: BUDDY_SLOT },
  buddyAnchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
