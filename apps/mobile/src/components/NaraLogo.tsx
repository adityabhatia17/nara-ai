/**
 * NaraLogo Component
 * The Nara brand mark: an ink rounded square with a cobalt circle dot inside.
 *
 * Three sizes:
 *   large  — 58px (splash, processing screen)
 *   medium — 34px (tab bar, headers)
 *   small  — 24px (inline, compact contexts)
 */

import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/tokens';

type LogoSize = 'large' | 'medium' | 'small';

interface NaraLogoProps {
  size?: LogoSize;
  style?: ViewStyle;
}

const SIZES: Record<LogoSize, { square: number; dot: number }> = {
  large:  { square: 58, dot: 16 },
  medium: { square: 34, dot: 9 },
  small:  { square: 24, dot: 6 },
};

export default function NaraLogo({ size = 'medium', style }: NaraLogoProps) {
  const { square, dot } = SIZES[size];

  return (
    <View
      style={[
        styles.square,
        {
          width: square,
          height: square,
          borderRadius: radius.mark, // 7px — mark radius
        },
        style,
      ]}
    >
      {/* Cobalt circle dot — centered in the mark */}
      <View
        style={[
          styles.dot,
          {
            width: dot,
            height: dot,
            borderRadius: radius.circle, // 9999 — perfect circle
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  square: {
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    backgroundColor: colors.accent,
  },
});
