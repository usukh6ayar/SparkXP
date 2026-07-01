import { useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { JoinClass } from '../../src/components/JoinClass';
import { AppText } from '../../src/components/Text';
import { t } from '../../src/i18n';
import { spacing, type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/** Deep-link target: `englishxp://join/CODE` → auto-submits the join request. */
export default function JoinWithCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="h3" style={styles.title}>{t('joinClass')}</AppText>
        <View style={{ width: 26 }} />
      </View>
      <JoinClass initialCode={code} />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  title: { flex: 1, textAlign: 'center' },
});
