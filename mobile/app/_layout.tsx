import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { colors } from "../src/theme/theme";

/**
 * Auth gate: logged-in users on login/register are sent to the main app.
 * Guests can browse tabs without signing in; login is optional from profile.
 */
function RootNavigator() {
  const { token, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (token && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [token, loading, segments]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // useEffect(() => {
  //   if (loading) return;
  //   const inAuthGroup = segments[0] === "(auth)";
  //   if (!token && !inAuthGroup) {
  //     router.replace("/(auth)/login");
  //   } else if (token && inAuthGroup) {
  //     router.replace("/(tabs)");
  //   }
  // }, [token, loading, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
});
