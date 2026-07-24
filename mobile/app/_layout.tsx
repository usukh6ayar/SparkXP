import { useEffect, useMemo, type ComponentType } from "react";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import Constants from "expo-constants";
import {
  useFonts,
  Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import {
  Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold,
} from "@expo-google-fonts/onest";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { SettingsProvider, useColors, useSettings } from "../src/settings/SettingsContext";
import { DictionaryProvider } from "../src/components/DictionaryProvider";
import { ToastHost } from "../src/components/Toast";
import { LockScreen } from "../src/components/LockScreen";

/**
 * Auth gate: redirects based on whether the user is logged in.
 * - Not logged in + not on an auth screen → go to login.
 * - Logged in + on an auth screen → go to the app (tabs).
 */
// TEMP: when true, the auth gate stops redirecting so onboarding / login /
// register can be browsed freely. Set false to restore normal behaviour.
const PREVIEW_AUTH = false;

function RootNavigator() {
  const { token, user, loading, onboarded, biometricEnabled, biometricLocked } = useAuth();
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
  // The lock overlay renders ON TOP of the (still-mounted) navigator so routing
  // keeps working underneath while content stays hidden until biometrics pass.
  return (
    <>
      <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
      {token && biometricEnabled && biometricLocked ? <LockScreen /> : null}
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
  const navTheme = useMemo(() => {
    const base = theme === "light" ? DefaultTheme : DarkTheme;
    return {
      ...base,
      colors: { ...base.colors, background: colors.background, card: colors.background },
    };
  }, [theme, colors]);

  return (
    <ThemeProvider value={navTheme}>
      <RootNavigator />
    </ThemeProvider>
  );
}

function RootLayout() {
  // Load the brand fonts (Onest = display/headings, Inter = body/UI; both have
  // full Cyrillic). Gate the app on load so text never flashes the system font,
  // but proceed on a font error so a load failure can never brick the app.
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold,
    Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Onest_800ExtraBold,
  });
  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.center, { backgroundColor: "#191040" }]}>
        <ActivityIndicator size="large" color="#6C3BFF" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AuthProvider>
            <DictionaryProvider>
              <BottomSheetModalProvider>
                <ThemedNav />
                <ToastHost />
              </BottomSheetModalProvider>
            </DictionaryProvider>
          </AuthProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Hot Updater OTA wrap — only on real native builds when a Worker URL is set.
 * Expo Go has no HotUpdater native module; wrapping there would crash, so we
 * skip it. Set EXPO_PUBLIC_HOT_UPDATER_URL after `npx hot-updater init`.
 * See docs/HOT_UPDATER.md.
 */
function withHotUpdater(App: ComponentType): ComponentType {
  const raw = process.env.EXPO_PUBLIC_HOT_UPDATER_URL?.trim();
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
    fallbackComponent: ({ progress, status }: { progress: number; status: string }) => (
      <View style={styles.otaFallback}>
        <Text style={styles.otaTitle}>
          {status === "UPDATING" ? "Шинэчлэл суулгаж байна…" : "Шинэчлэл шалгаж байна…"}
        </Text>
        {progress > 0 ? (
          <Text style={styles.otaProgress}>{Math.round(progress * 100)}%</Text>
        ) : null}
      </View>
    ),
  })(App);
}

export default withHotUpdater(RootLayout);

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
});
