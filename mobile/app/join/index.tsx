import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JoinClass } from '../../src/components/JoinClass';
import { TopBar } from '../../src/components/TopBar';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme/theme';

/** Student opens this from Home to join a class by code or QR. */
export default function JoinScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('joinClass')} back showBadges={false} />
      <JoinClass />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
