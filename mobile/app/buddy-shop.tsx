import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, ZoomIn, useSharedValue, useAnimatedStyle, withTiming, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/auth/AuthContext';
import { getMe } from '../src/api/auth';
import {
  getBackgrounds,
  buyBackground,
  equipBackground,
  type BackgroundView,
} from '../src/api/buddyBackgrounds';
import { TopBar } from '../src/components/TopBar';
import { AppText } from '../src/components/Text';
import { AppIcon } from '../src/components/AppIcon';
import { AppImage } from '../src/components/AppImage';
import { PressableScale } from '../src/components/PressableScale';
import { EmptyState } from '../src/components/EmptyState';
import { SkeletonRows } from '../src/components/SkeletonRows';
import { haptics } from '../src/lib/haptics';
import { alertError } from '../src/lib/alerts';
import { t, tf } from '../src/i18n';
import { useColors } from '../src/settings/SettingsContext';
import { spacing, radius, type AppColors } from '../src/theme/theme';
import { bounded } from '../src/theme/responsive';

/**
 * AI Buddy Background Shop — browse, buy (Sparks) and equip the scene shown
 * behind the buddy. Server-driven catalog (`/buddy/backgrounds`); the buy flow
 * spends Sparks and refreshes the balance, and the equipped state animates in.
 */
export default function BuddyShopScreen() {
  const { user, token, updateUser } = useAuth();
  const c = useColors();
  const styles = makeStyles(c);

  const [items, setItems] = useState<BackgroundView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Floating "-N 💎" shown by the Sparks badge after a purchase.
  const [spent, setSpent] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await getBackgrounds(token));
    } catch (e) {
      console.warn('Backgrounds load failed:', (e as Error)?.message ?? e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onBuy = (bg: BackgroundView) => {
    if (!token || busyId) return;
    Alert.alert(
      t('bgConfirmBuyTitle'),
      tf('bgConfirmBuyBody', { name: bg.name, n: bg.priceSparks }),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('bgBuy'),
          onPress: async () => {
            setBusyId(bg.id);
            try {
              const res = await buyBackground(bg.id, token);
              haptics.success();
              if (res.sparksSpent > 0) setSpent(res.sparksSpent); // trigger the deduction flash
              getMe(token).then(updateUser).catch(() => {}); // Sparks dropped — resync
              await load();
            } catch (e) {
              alertError(e instanceof Error ? e.message : t('errorGeneric'));
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const onEquip = async (bg: BackgroundView) => {
    if (!token || busyId) return;
    setBusyId(bg.id);
    try {
      await equipBackground(bg.id, token);
      haptics.select();
      await load();
    } catch (e) {
      alertError(e instanceof Error ? e.message : t('errorGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <TopBar
        title={t('buddyShopTitle')}
        back
        showBadges={false}
      />
      {/* Sparks balance + the post-purchase deduction flash. */}
      <View style={styles.balanceRow}>
        <View style={styles.balancePill}>
          <AppIcon name="sparks" size={20} />
          <AppText variant="bodyStrong" color={c.text}>{user?.sparks ?? 0}</AppText>
        </View>
        {spent > 0 ? <SparksFlash amount={spent} onDone={() => setSpent(0)} color={c.danger} /> : null}
      </View>

      <ScrollView contentContainerStyle={[styles.container, bounded]}>
        {loading ? (
          <SkeletonRows count={4} />
        ) : items.length === 0 ? (
          <EmptyState icon="image" title={t('buddyShopTitle')} hint={t('bgEmpty')} />
        ) : (
          <View style={styles.grid}>
            {items.map((bg) => (
              <View key={bg.id} style={styles.cardWrap}>
                <View style={styles.card}>
                  <AppImage source={bg.imageUrl} width={480} style={styles.preview} contentFit="cover" />
                  {bg.equipped ? (
                    <Animated.View entering={ZoomIn.springify()} style={[styles.equippedTag, { backgroundColor: c.success }]}>
                      <Ionicons name="checkmark" size={14} color={c.white} />
                    </Animated.View>
                  ) : null}
                  {bg.isPremium ? (
                    <View style={[styles.premiumTag, { backgroundColor: c.xp }]}>
                      <AppText variant="overline" color="#1A1330">{t('bgPremiumLabel')}</AppText>
                    </View>
                  ) : null}
                </View>

                <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>{bg.name}</AppText>
                {renderAction(bg)}
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );

  function renderAction(bg: BackgroundView) {
    const disabled = busyId === bg.id;
    if (bg.equipped) {
      return (
        <View style={[styles.action, styles.actionOwned]}>
          <Ionicons name="checkmark-circle" size={16} color={c.success} />
          <AppText variant="label" color={c.success}>{t('bgEquipped')}</AppText>
        </View>
      );
    }
    if (bg.owned) {
      return (
        <PressableScale style={[styles.action, styles.actionPrimary]} disabled={disabled} onPress={() => onEquip(bg)}>
          <AppText variant="label" color={c.white}>{t('bgEquip')}</AppText>
        </PressableScale>
      );
    }
    if (bg.premiumLocked) {
      return (
        <View style={[styles.action, styles.actionLocked]}>
          <Ionicons name="lock-closed" size={14} color={c.textMuted} />
          <AppText variant="label" color={c.textMuted}>{t('bgPremiumLabel')}</AppText>
        </View>
      );
    }
    // Purchasable.
    return (
      <PressableScale style={[styles.action, styles.actionBuy]} disabled={disabled} onPress={() => onBuy(bg)}>
        <AppIcon name="sparks" size={15} />
        <AppText variant="label" color={c.white}>
          {bg.priceSparks > 0 ? bg.priceSparks : t('bgBuy')}
        </AppText>
      </PressableScale>
    );
  }
}

/** "-N 💎" that floats up and fades once, then calls `onDone`. */
function SparksFlash({ amount, onDone, color }: { amount: number; onDone: () => void; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withSequence(withTiming(1, { duration: 700 }), withTiming(1, { duration: 300 }));
    const id = setTimeout(onDone, 1100);
    return () => clearTimeout(id);
  }, [p, onDone]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value,
    transform: [{ translateY: -18 * p.value }],
  }));
  return (
    <Animated.View entering={FadeIn.duration(120)} style={[flashStyles.flash, style]}>
      <AppText variant="bodyStrong" color={color}>-{amount}</AppText>
      <AppIcon name="sparks" size={16} />
    </Animated.View>
  );
}

const flashStyles = StyleSheet.create({
  flash: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});

const makeStyles = (c: AppColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    balancePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: radius.full,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    container: { padding: spacing.lg, paddingTop: spacing.sm },
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg },
    cardWrap: { width: '48%', gap: spacing.xs },
    card: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.border,
    },
    preview: { width: '100%', aspectRatio: 16 / 10 },
    equippedTag: {
      position: 'absolute', top: spacing.sm, right: spacing.sm,
      width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    },
    premiumTag: {
      position: 'absolute', top: spacing.sm, left: spacing.sm,
      paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full,
    },
    name: { paddingHorizontal: 2 },
    action: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
      height: 38, borderRadius: radius.md, paddingHorizontal: spacing.md,
    },
    actionBuy: { backgroundColor: c.primary },
    actionPrimary: { backgroundColor: c.primary },
    actionOwned: { backgroundColor: c.successSoft },
    actionLocked: { backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border },
  });
