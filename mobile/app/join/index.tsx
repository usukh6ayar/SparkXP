import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { JoinClass } from '../../src/components/JoinClass';
import { TopBar } from '../../src/components/TopBar';
import { t } from '../../src/i18n';
import { type AppColors } from '../../src/theme/theme';
import { useColors } from '../../src/settings/SettingsContext';

/** Student opens this from Home to join a class by code or QR. */
export default function JoinScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('joinClass')} back showBadges={false} />
      <JoinClass />
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
});
