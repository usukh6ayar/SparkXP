import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../settings/SettingsContext';
import { radius } from '../theme/theme';
import { DURATION, SPRING, useReduceMotion } from '../lib/motion';

/** Хоосон · хэсэгчилсэн · бүгд. `'some'` нь зөвхөн бүлэг сонгоход утгатай. */
export type SelectState = 'off' | 'some' | 'on';

/**
 * Сонголтын тэмдэг — жагсаалтын мөр, бүлгийн толгойд.
 *
 * **Яагаад дугуй вэ:** Ionicons-ийн `square-outline`/`checkbox` хос нь хатуу
 * ирмэгтэй, вэб маягийн харагдацтай бөгөөд аппын бусад бүх зүйл (аватар,
 * дүрсний хайрцаг, чип, товч) дугуйрсан хэлбэртэй байхад ганцаараа тусдаг
 * байв. Дугуй тэмдэг нь мөн хуруунд илүү том зорилт мэт унших тул жагсаалт
 * дундуур хурдан чагтлахад тохиромжтой.
 *
 * Гурван төлөв нь **өнгө биш хэлбэрээр** ялгагдана (өнгө ялгахгүй хүнд ч
 * уншигдана): хоосон нь хоосон, хэсэгчилсэн нь зураас, бүгд нь чагт.
 *
 * Товшилт бүрд бага зэрэг «түлхэлт» (scale spring) өгнө — сонголт бүртгэгдсэн
 * гэдгийг мэдрүүлнэ. Reduce Motion асаалттай бол шууд солигдоно.
 */
export function SelectMark({
  state,
  size = 24,
  /** Бүлгийн толгойд илүү тод: сонгоогүй үед ч хүрээ нь бүдгэрэхгүй. */
  emphasis = false,
}: {
  state: SelectState;
  size?: number;
  emphasis?: boolean;
}) {
  const c = useColors();
  const reduce = useReduceMotion();
  const on = state !== 'off';

  const scale = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    // Товшилт бүрд нэг л удаа — үргэлжлэх хөдөлгөөн биш.
    scale.value = withSequence(
      withTiming(0.86, { duration: DURATION.fast / 2 }),
      withSpring(1, SPRING),
    );
  }, [state, reduce]);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.ring,
        anim,
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          borderWidth: on ? 0 : 2,
          borderColor: emphasis ? c.borderStrong : c.border,
          backgroundColor:
            state === 'on' ? c.primary : state === 'some' ? c.primarySoft : 'transparent',
        },
      ]}
    >
      {state === 'on' ? (
        <Ionicons name="checkmark" size={size * 0.62} color={c.white} />
      ) : state === 'some' ? (
        // Зураас — «зарим нь» гэдгийг чагтгүйгээр хэлнэ.
        <View style={[styles.dash, { width: size * 0.42, backgroundColor: c.primary }]} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { alignItems: 'center', justifyContent: 'center' },
  dash: { height: 2.5, borderRadius: 2 },
});
