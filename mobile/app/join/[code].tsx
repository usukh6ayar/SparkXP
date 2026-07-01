import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { JoinClass } from '../../src/components/JoinClass';
import { TopBar } from '../../src/components/TopBar';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme/theme';

/** Deep-link target: `englishxp://join/CODE` → auto-submits the join request. */
export default function JoinWithCodeScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('joinClass')} back showBadges={false} />
      <JoinClass initialCode={code} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
