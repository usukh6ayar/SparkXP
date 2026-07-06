import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from './Text';
import { useColors } from '../settings/SettingsContext';
import { haptics } from '../lib/haptics';
import { spacing, radius, elevation } from '../theme/theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Tone = 'default' | 'success' | 'error' | 'xp';

export interface ToastOptions {
  message: string;
  icon?: IconName;
  tone?: Tone;
  /** Milliseconds on screen before auto-dismiss (default 2200). */
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

// --- Imperative bus ---------------------------------------------------------
// A singleton so ANY code (even non-React helpers like xpToast) can raise a
// toast without threading a hook through props. The mounted <ToastHost/>
// subscribes and renders. One place owns the UI (DRY); callers just fire.
let listener: ((item: ToastItem) => void) | null = null;
let nextId = 1;

export const toast = {
  show(opts: ToastOptions) {
    listener?.({ id: nextId++, tone: 'default', ...opts });
  },
  success(message: string, icon: IconName = 'checkmark-circle') {
    this.show({ message, icon, tone: 'success' });
  },
  error(message: string, icon: IconName = 'alert-circle') {
    this.show({ message, icon, tone: 'error' });
  },
  /** Gold "+N XP" floating reward toast. */
  xp(amount: number) {
    this.show({ message: `+${amount} XP`, icon: 'flash', tone: 'xp', duration: 1600 });
  },
};

// --- Host -------------------------------------------------------------------
/** Renders queued toasts. Mount ONCE near the app root (inside SettingsProvider
 *  so `useColors` works). Stacks toasts top-center, auto-dismissing each. */
export function ToastHost() {
  const c = useColors();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listener = (item) => {
      if (item.tone === 'success' || item.tone === 'xp') haptics.success();
      else if (item.tone === 'error') haptics.error();
      setItems((prev) => [...prev, item]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, item.duration ?? 2200);
    };
    return () => { listener = null; };
  }, []);

  if (items.length === 0) return null;

  const toneStyle = (tone?: Tone) => {
    if (tone === 'success') return { bg: c.success, fg: c.white };
    if (tone === 'error') return { bg: c.danger, fg: c.white };
    if (tone === 'xp') return { bg: c.xp, fg: '#3A2A00' };
    return { bg: c.navy, fg: c.background };
  };

  return (
    <SafeAreaView pointerEvents="none" style={styles.host} edges={['top']}>
      {items.map((item) => {
        const tone = toneStyle(item.tone);
        return (
          <Animated.View
            key={item.id}
            entering={FadeInUp.springify().damping(16)}
            exiting={FadeOutUp.duration(180)}
            style={[styles.toast, { backgroundColor: tone.bg }]}
          >
            {item.icon ? <Ionicons name={item.icon} size={16} color={tone.fg} /> : null}
            <AppText variant="bodyStrong" color={tone.fg}>{item.message}</AppText>
          </Animated.View>
        );
      })}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, marginTop: spacing.sm,
    ...(elevation.float as object),
  },
});
