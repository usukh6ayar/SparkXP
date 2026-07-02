import { useEffect, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { SettingsProvider, useColors, useSettings } from "../src/settings/SettingsContext";
import { DictionaryProvider } from "../src/components/DictionaryProvider";

/**
 * Auth gate: redirects based on whether the user is logged in.
 * - Not logged in + not on an auth screen → go to login.
 * - Logged in + on an auth screen → go to the app (tabs).
 */
// TEMP: when true, the auth gate stops redirecting so onboarding / login /
// register can be browsed freely. Set false to restore normal behaviour.
const PREVIEW_AUTH = false;

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

  return <Stack screenOptions={{ headerShown: false }} />;
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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <SettingsProvider>
          <AuthProvider>
            <DictionaryProvider>
              <BottomSheetModalProvider>
                <ThemedNav />
              </BottomSheetModalProvider>
            </DictionaryProvider>
          </AuthProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
