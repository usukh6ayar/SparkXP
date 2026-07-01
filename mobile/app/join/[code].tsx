import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { JoinClass } from '../../src/components/JoinClass';
import { TopBar } from '../../src/components/TopBar';
import { t } from '../../src/i18n';
import { type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/** Deep-link target: `englishxp://join/CODE` → auto-submits the join request. */
export default function JoinWithCodeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('joinClass')} back showBadges={false} />
      <JoinClass initialCode={code} />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
