import { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { redeemPromo, type PromoRedeemResult } from '../src/api/promos';
import { t, tf } from '../src/i18n';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { TextField } from '../src/components/TextField';
import { Button } from '../src/components/Button';
import { ActionButton } from '../src/components/ActionButton';
import { FormError } from '../src/components/FormError';
import { spacing, radius, tints, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';
import { useColors } from '../src/settings/SettingsContext';

/**
 * «Промо код» — type a code, get free plan access (admin-issued promo or an
 * influencer's 7-day trial). The server decides everything; this screen only
 * sends the code and shows what it gave.
 */
export default function PromoScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { token } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PromoRedeemResult | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar title={t('promoCode')} back showBadges={false} />
      <ScrollView
        contentContainerStyle={[styles.container, bounded]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {result ? (
          <View style={styles.doneWrap}>
            <Ionicons name="gift" size={72} color={colors.success} />
            <AppText variant="h2" center>{t('promoRedeemed')}</AppText>
            <AppText variant="body" color={colors.textSecondary} center>
              {tf('promoAccessUntil', {
                plan: result.planName ?? '',
                date: new Date(result.accessUntil).toLocaleDateString(),
              })}
            </AppText>
            <Button label={t('promoSeePlan')} onPress={() => router.replace('/plan')} style={styles.button} />
          </View>
        ) : (
          <>
            <View style={styles.iconWrap}>
              <Ionicons name="pricetag" size={26} color={tints.purple.fg} />
            </View>
            <AppText variant="body" color={colors.textSecondary} style={styles.subtitle}>
              {t('promoSubtitle')}
            </AppText>
            <TextField
              leftIcon="pricetag-outline"
              label={t('promoCode')}
              placeholder="SPX-XXXXXX"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={32}
              value={code}
              onChangeText={(v) => { setCode(v.toUpperCase()); setError(null); }}
            />
            <FormError message={error} />
            <ActionButton
              label={t('promoRedeem')}
              action={() => redeemPromo(code, token!)}
              onSuccess={setResult}
              onError={setError}
              disabled={code.trim().length < 3 || !token}
              style={styles.button}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: AppColors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xxl },
  iconWrap: {
    width: 56, height: 56, borderRadius: radius.md, alignSelf: 'center',
    backgroundColor: tints.purple.bg, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.md,
  },
  subtitle: { textAlign: 'center', marginBottom: spacing.xl },
  button: { marginTop: spacing.lg },
  doneWrap: { alignItems: 'center', justifyContent: 'center', flex: 1, gap: spacing.sm },
});
