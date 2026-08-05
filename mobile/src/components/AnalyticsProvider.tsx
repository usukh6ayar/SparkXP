import { useEffect, useRef, type ReactNode } from 'react';
import { usePathname } from 'expo-router';
import { PostHogProvider } from 'posthog-react-native';
import { posthog, trackScreen } from '../lib/analytics';

/**
 * Wires PostHog into the tree and reports screen views.
 *
 * Two things worth knowing:
 *
 * 1. **It renders plain children when analytics are off.** `PostHogProvider`
 *    returns `null` when it has neither a client nor an API key — mounting it
 *    unconditionally would blank the entire app for anyone without the key.
 *
 * 2. **Screen views are captured by hand.** PostHog's `captureScreens`
 *    autocapture reads the React Navigation container, which expo-router does
 *    not expose, so its own docs tell expo-router apps to disable it and send
 *    screens manually. `usePathname()` is the router's supported way to do that.
 *
 * Touch autocapture stays off: it records element labels, which on this app's
 * forms and lesson screens can contain what a student typed.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  if (!posthog) return <>{children}</>;

  return (
    <PostHogProvider
      client={posthog}
      autocapture={{ captureScreens: false, captureTouches: false }}
    >
      <ScreenTracker />
      {children}
    </PostHogProvider>
  );
}

/** Sends one `$screen` event per route change. Renders nothing. */
function ScreenTracker() {
  const pathname = usePathname();
  // Expo Router can re-render the same path (params, focus); only a real change
  // should count as a screen view.
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    trackScreen(normalise(pathname), { path: pathname });
  }, [pathname]);

  return null;
}

/**
 * Collapse dynamic segments so "/lesson/9f3c…" and "/lesson/22a1…" are one
 * screen in the dashboard instead of thousands. UUIDs and numeric ids become
 * `:id`; everything else is left as-is.
 */
function normalise(pathname: string): string {
  return pathname
    .split('/')
    .map((part) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(part) || /^\d+$/.test(part) ? ':id' : part,
    )
    .join('/');
}
