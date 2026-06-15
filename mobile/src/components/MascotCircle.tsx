import { type ReactNode } from 'react';
import { View, Image, StyleSheet, type ImageSourcePropType } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../theme/theme';

/**
 * Round mascot backdrop used on onboarding / success screens: a soft (or
 * gradient) circle with the fox image centered. Floating badges are passed as
 * `children` and positioned absolutely by the caller relative to this circle.
 */
export function MascotCircle({
  image,
  size = 260,
  gradient = false,
  children,
}: {
  image: ImageSourcePropType;
  size?: number;
  gradient?: boolean;
  children?: ReactNode;
}) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {gradient ? (
        <LinearGradient
          colors={[...colors.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.circle, circle]}
        />
      ) : (
        <View style={[styles.circle, circle, styles.soft]} />
      )}
      <Image
        source={image}
        style={{ width: size * 0.7, height: size * 0.7 }}
        resizeMode="contain"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute' },
  soft: { backgroundColor: colors.primarySoft },
});
