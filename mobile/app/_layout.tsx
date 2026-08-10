import { useEffect, useMemo, type ComponentType } from "react";
import { View, ActivityIndicator, StyleSheet, Text, useColorScheme } from "react-native";
import { Stack, useRouter, useSegments, useNavigationContainerRef } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import * as SplashScreen from "expo-splash-screen";
import Constants from "expo-constants";
import {
  useFonts,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import {
  SettingsProvider, useColors, useSettings, useStatusBarStyle,
} from "../src/settings/SettingsContext";
import { DictionaryProvider } from "../src/components/DictionaryProvider";
import { ToastHost } from "../src/components/Toast";
import { CelebrationHost } from "../src/components/CelebrationHost";
import { AnalyticsProvider } from "../src/components/AnalyticsProvider";
import {
  initMonitoring, monitoringEnabled, navigationIntegration, wrapRoot,
} from "../src/lib/monitoring";

// Start crash reporting before anything renders, or boot-time crashes — the
// ones we can least afford to miss — happen with no reporter listening. Inert
// unless EXPO_PUBLIC_SENTRY_DSN is set (see src/lib/monitoring.ts).
initMonitoring();

/**
 * Auth gate: redirects based on whether the user is logged in.
 * - Not logged in + not on an auth screen → go to login.
 * - Logged in + on an auth screen → go to the app (tabs).
 */
// TEMP: when true, the auth gate stops redirecting so onboarding / login /
// register can be browsed freely. Set false to restore normal behaviour.
const PREVIEW_AUTH = false;

// Keep the native splash (fox on the brand background, see `app.json` →
// `expo-splash-screen`) on screen until the fonts below are ready. Without this
// the splash hides on the first frame and the user sees a blank screen while
// the fonts load. Errors are ignored: a splash that refuses to hide would brick
// the app, and in Expo Go there is no native splash of ours to control.
SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * The two splash backgrounds declared in `app.json` → `expo-splash-screen`
 * (`backgroundColor` + its `dark` override). Kept in sync BY HAND — the plugin
 * config is native, so JS cannot read it. Change one, change the other.
 */
const SPLASH_BG = { light: "#F6F4FD", dark: "#0B0716" } as const;

function RootNavigator() {
  const { token, user, loading, onboarded } = useAuth();
  const colors = useColors();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (PREVIEW_AUTH || loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inTeacherGroup = segments[0] === "(teacher)";
    const inTabsGroup = segments[0] === "(tabs)";
    const isTeacher = user?.role === "teacher";
    if (token) {
      // Logged in — keep each role out of the *other* role's screens and out of
      // auth/onboarding. Standalone shared routes (e.g. /avatar) are left alone
      // so both roles can open them.
      if (isTeacher && (inAuthGroup || inTabsGroup)) {
        router.replace("/(teacher)");
      } else if (!isTeacher && (inAuthGroup || inTeacherGroup)) {
        router.replace("/(tabs)");
      }
    } else if (!inAuthGroup) {
      // Not logged in: first-time users see onboarding, returners go to login.
      router.replace(onboarded ? "/(auth)/login" : "/(auth)/onboarding");
    }
  }, [token, user, loading, onboarded, segments]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Platform-standard push transition so screens slide in instead of snapping.
  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
    </>
  );
}

/**
 * Provides React Navigation's container theme from the ACTIVE app theme so the
 * navigator background (behind screens / the floating tab bar) matches
 * light/dark instead of a fixed night-sky. Must live inside SettingsProvider.
 */
function ThemedNav() {
  const { theme } = useSettings();
  const colors = useColors();
  const statusBarStyle = useStatusBarStyle();
  const navTheme = useMemo(() => {
    const base = theme === "light" ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.background, card: colors.background },
    };
  }, [theme, colors]);

  return (
    <ThemeProvider value={navTheme}>
      {/*
        THE one status bar for the whole app — driven by the active theme so the
        clock/battery stay readable on every screen.

        Do NOT move this to the navigators' `statusBarStyle` screen option: that
        is react-native-screens' per-screen mode, which iOS only allows when
        `UIViewControllerBasedStatusBarAppearance` is YES in Info.plist. Expo
        ships it as NO (so this JS API works), and flipping it means editing
        native config + a rebuild. Screens must not call `setStatusBarStyle`
        imperatively either — that leaks to the next screen, which is how
        leaving Settings used to hide the icons.
      */}
      <StatusBar style={statusBarStyle} />
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootLayout() {
  // Which splash colour the OS already painted (see the pre-font return below).
  const scheme = useColorScheme() === "dark" ? "dark" : "light";

  // Hand the router's navigation container to Sentry so every screen change
  // becomes a performance transaction (screen load time + the API calls it
  // makes). This is what stands in for EAS Observe, which needs SDK 55.
  // Guarded on `monitoringEnabled`: with no DSN configured — the default for
  // every dev right now — Sentry.init() never ran, and there is no reason to
  // hand instrumentation to a client that does not exist.
  const navigationRef = useNavigationContainerRef();
  useEffect(() => {
    if (monitoringEnabled && navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef);
    }
  }, [navigationRef]);

  // Load the brand fonts (Manrope = display/headings, Inter = body/UI). Both
  // cover Mongolian Cyrillic Ө/ө/Ү/ү — Onest did NOT, so those letters fell back
  // to the system font mid-word. React Native takes a single `fontFamily` (no CSS
  // fallback list), so any display font we use must ship those glyphs itself.
  // Gate the app on load so text never flashes the system font, but proceed on a
  // font error so a load failure can never brick the app.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
  });

  // iOS mutes app audio when the physical ring/silent switch is on unless we opt
  // out — without this, word pronunciation is silent on an iPhone while it plays
  // fine on Android. Set once for the whole app; screens that record (chat) still
  // flip `allowsRecording` for their session.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  // Fonts settled (loaded or failed) → hand the screen over to the app.
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return (
      // Must match the splash `backgroundColor` in `app.json`, or a lost race
      // between `hideAsync` and the first render flashes a different colour.
      // `app.json` declares BOTH (light `#F6F4FD` + `dark` `#0B0716`) and the
      // native splash picks between them by SYSTEM scheme — so this has to read
      // the system too, not the app theme. It also renders above
      // `SettingsProvider`, so the app theme isn't available here anyway.
      <View style={[styles.center, { backgroundColor: SPLASH_BG[scheme] }]}>
        <ActivityIndicator size="large" color="#6C3BFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SettingsProvider>
          {/* Outside AuthProvider so login/logout can identify + reset through
              the already-mounted client (see src/lib/analytics.ts). */}
          <AnalyticsProvider>
            <AuthProvider>
              <DictionaryProvider>
                <BottomSheetModalProvider>
                  <ThemedNav />
                  <ToastHost />
                  <CelebrationHost />
                </BottomSheetModalProvider>
              </DictionaryProvider>
            </AuthProvider>
          </AnalyticsProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * OTA update Worker (public URL — also in `eas.json` and docs/HOT_UPDATER.md).
 *
 * ⚠️ This is a **hardcoded default on purpose.** It used to come only from
 * `EXPO_PUBLIC_HOT_UPDATER_URL`, which lives in `eas.json`'s build profiles —
 * so it was inlined into EAS builds but NOT into OTA bundles, because
 * `hot-updater deploy` runs `expo export` locally and reads `mobile/.env`
 * (where nobody has this key). The result was a bundle that silently shipped
 * with OTA **disabled**: any device that installed it stopped checking for
 * updates forever and could only be recovered by reinstalling the app.
 * A public endpoint baked into the JS removes that whole failure mode.
 */
const HOT_UPDATER_URL = "https://sparkxp-hot-updater.sparkxp.workers.dev";

/**
 * Hot Updater OTA wrap — only on real native builds.
 * Expo Go has no HotUpdater native module; wrapping there would crash, so we
 * skip it. See docs/HOT_UPDATER.md.
 */
function withHotUpdater(App: ComponentType): ComponentType {
  // Env var stays as an override (staging worker, local testing).
  const raw = process.env.EXPO_PUBLIC_HOT_UPDATER_URL?.trim() || HOT_UPDATER_URL;
  const inExpoGo = Constants.appOwnership === "expo";
  if (!raw || inExpoGo) return App;

  // Lazy require so Expo Go never loads the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { HotUpdater } = require("@hot-updater/react-native") as typeof import("@hot-updater/react-native");
  const base = raw.replace(/\/$/, "");
  const checkURL = base.endsWith("/api/check-update")
    ? base
    : `${base}/api/check-update`;

  return HotUpdater.wrap({
    baseURL: checkURL,
    updateStrategy: "appVersion",
    // Without this the library swallows every check/download failure: a wrong
    // or undeployed Worker URL just means "no update, ever" with nothing in the
    // logs. The app still starts normally — this only makes the cause visible.
    onError: (err: unknown) => {
      console.warn(
        "[HotUpdater] update check/download failed:",
        err instanceof Error ? err.message : String(err),
        "| endpoint:",
        checkURL,
      );
    },
    // Update screen. This renders BEFORE the app's providers mount, so it can
    // use neither the theme nor i18n — colours and copy are literal on purpose.
    fallbackComponent: ({ progress, status, downloadedBytes, totalBytes }) => {
      const downloading = status === "UPDATING";
      const pct = Math.max(0, Math.min(100, Math.round((progress ?? 0) * 100)));
      // Size is only known once the download responds with Content-Length.
      const showSize = downloading && !!totalBytes && totalBytes > 0;
      const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

      return (
        <View style={styles.otaFallback}>
          <Text style={styles.otaTitle}>
            {downloading ? "Шинэчлэл татаж байна…" : "Шинэчлэл шалгаж байна…"}
          </Text>

          {downloading ? (
            <>
              <Text style={styles.otaPercent}>{pct}%</Text>
              <View style={styles.otaTrack}>
                <View style={[styles.otaFill, { width: `${pct}%` }]} />
              </View>
              {showSize ? (
                <Text style={styles.otaProgress}>
                  {mb(downloadedBytes ?? 0)} / {mb(totalBytes)} MB
                </Text>
              ) : null}
              <Text style={styles.otaHint}>Аппыг хаахгүй байна уу</Text>
            </>
          ) : (
            <ActivityIndicator size="small" color="#B9A9E6" style={styles.otaSpinner} />
          )}
        </View>
      );
    },
  })(App);
}

// Sentry wraps OUTSIDE the OTA wrapper so a crash in the update screen itself
// is still reported. `wrapRoot` is a passthrough when monitoring is off.
export default wrapRoot(withHotUpdater(RootLayout));

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  otaFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#191040",
    padding: 24,
  },
  otaTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  otaProgress: {
    color: "#B9A9E6",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  // Big percentage — the number the user actually watches.
  otaPercent: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    marginTop: 20,
  },
  otaTrack: {
    width: "100%",
    maxWidth: 280,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#372A7A",
    marginTop: 14,
    overflow: "hidden",
  },
  otaFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: "#6C3BFF",
  },
  otaHint: {
    color: "#8E80BC",
    fontSize: 13,
    marginTop: 18,
  },
  otaSpinner: { marginTop: 18 },
});
