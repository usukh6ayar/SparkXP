import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { DictionaryProvider } from "../src/components/DictionaryProvider";
import { colors } from "../src/theme/theme";

// Dark navigation theme so every navigator container (stack + tabs) uses our
// night-sky background instead of React Navigation's default WHITE. Without
// this, the white container shows through the transparent floating tab bar as a
// white strip under the bar.
const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
  },
};

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider value={navTheme}>
          <AuthProvider>
            <DictionaryProvider>
              <BottomSheetModalProvider>
                <RootNavigator />
              </BottomSheetModalProvider>
            </DictionaryProvider>
          </AuthProvider>
        </ThemeProvider>
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
    backgroundColor: colors.surface,
  },
});
