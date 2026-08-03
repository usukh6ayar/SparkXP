import { useWindowDimensions, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSettings } from '../settings/SettingsContext';
import { haptics } from '../lib/haptics';
import { useReduceMotion } from '../lib/motion';
import { spacing } from '../theme/theme';
import { WaveCard } from './tabbar/WaveCard';
import { TabItem, type TabIcon } from './tabbar/TabItem';
import { BuddyTab } from './tabbar/BuddyTab';
import { BAR_H, BUDDY_OUTER, BUDDY_SLOT, LIFT, TOTAL_H, WAVE_H } from './tabbar/geometry';

const buddy = require('../../assets/buddy-menu.webp');

/** The buddy's own route — rendered as the floating hero, not as a flat tab. */
const BUDDY_ROUTE = 'chat';

/** Route → icon pair. Tab ORDER comes from `app/(tabs)/_layout.tsx`, not here. */
const ICONS: Record<string, TabIcon> = {
  index: { outline: 'home-outline', filled: 'home' },
  lessons: { outline: 'book-outline', filled: 'book' },
  soril: { outline: 'game-controller-outline', filled: 'game-controller' },
  profile: { outline: 'person-circle-outline', filled: 'person-circle' },
};

/**
 * SparkXP's bottom navigation: a floating glass card whose top edge is one long
 * wave, with the AI buddy riding the crest as the primary call to action.
 *
 * Three files, one job each — the shape (`WaveCard`), a flat tab (`TabItem`),
 * the hero (`BuddyTab`); the numbers they share live in `tabbar/geometry.ts`.
 *
 * The root view is `box-none` and taller than the card on purpose: the buddy
 * needs room to float above the card, and on Android a child drawn outside its
 * parent draws but does not receive touches. The extra band is transparent and
 * passes taps through to the screen underneath. In the row the buddy leaves a
 * fixed-width gap behind, so the four flat tabs space themselves around it.
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

  /** −1…1: how far left or right of centre a tab sits. The wave leans by it. */
  const driftOf = (position: number) => (position - (visible.length - 1) / 2) / 2;

  // Seeded from the tab the app opens on, so the wave is already leaning the
  // right way on the first frame instead of snapping after the first tap.
  const drift = useSharedValue(
    driftOf(visible.findIndex((r) => r === state.routes[state.index])),
  );

  /** Switch tabs, nudging the wave toward the one that was picked. */
  const select = (route: (typeof visible)[number]) => {
    const focused = state.index === state.routes.indexOf(route);
    const event = navigation.emit({
      type: 'tabPress',
      target: route.key,
      canPreventDefault: true,
    });
    if (focused || event.defaultPrevented) return;
    haptics.select(); // tactile tick when switching tabs
    drift.value = driftOf(visible.indexOf(route));
    navigation.navigate(route.name);
  };

  const buddyRoute = visible.find((r) => r.name === BUDDY_ROUTE);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.root, { height: TOTAL_H + insets.bottom }]}
      entering={reduce ? undefined : SlideInDown.springify().damping(18).mass(0.7)}
    >
      <WaveCard width={width} bottomInset={insets.bottom} drift={drift} />

      {/* Sits ON the card body and stops where the safe area begins, so the
          icons are optically centred in the bar instead of being pushed down
          against the home indicator. */}
      <View style={[styles.row, { bottom: insets.bottom }]}>
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
            // Centre the avatar on the crest of the wave, lifted a touch above
            // it so the swell reads as the wake it leaves behind.
            { bottom: WAVE_H + BAR_H + insets.bottom - BUDDY_OUTER / 2 + LIFT },
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
   * In normal flow, NOT absolute: React Navigation measures this view to work
   * out how much bottom padding each screen needs. Absolute here would measure
   * as zero and every screen's last row would slide under the card. Everything
   * inside is positioned against it instead.
   */
  root: { backgroundColor: 'transparent' },
  /** The flat tabs, sitting on the card below the wave's shoulders. */
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: BAR_H,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buddySlot: { width: BUDDY_SLOT },
  buddyAnchor: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
