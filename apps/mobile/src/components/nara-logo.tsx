/**
 * NaraLogo
 * The Nara visual identity: a rounded-square mark + "Nara" wordmark.
 *
 * Design (from Nara.dc.html lines 33-35):
 *   Header: mark 25px, 7px radius, ink bg, centered 8px cobalt dot
 *   Wordmark: 18px, weight 700, tracking -0.4px, gap 9px from mark
 */

import { View, Text, StyleSheet } from 'react-native';
import { colors, fontFamily } from '@/theme/tokens';

type LogoSize = 'large' | 'medium' | number;

interface NaraLogoProps {
  size?: LogoSize;
  showWordmark?: boolean;
}

function resolveSize(size: LogoSize): { mark: number; text: number; dot: number; markRadius: number; gap: number } {
  if (size === 'large')  return { mark: 58, text: 32, dot: 10, markRadius: 16, gap: 12 };
  if (size === 'medium') return { mark: 25, text: 18, dot: 8, markRadius: 7, gap: 9 };
  const mark = size as number;
  return { mark, text: Math.round(mark * 0.72), dot: Math.round(mark * 0.32), markRadius: Math.round(mark * 0.28), gap: Math.round(mark * 0.36) };
}

export function NaraLogo({ size = 'medium', showWordmark = true }: NaraLogoProps) {
  const { mark, text, dot, markRadius, gap } = resolveSize(size);

  return (
    <View style={[styles.row, { gap }]}>
      {/* The mark */}
      <View
        style={[
          styles.mark,
          {
            width: mark,
            height: mark,
            borderRadius: markRadius,
          },
        ]}
      >
        {/* Cobalt accent dot -- centered */}
        <View
          style={[
            styles.dot,
            {
              width: dot,
              height: dot,
              borderRadius: 9999,
            },
          ]}
        />
      </View>

      {showWordmark && (
        <Text
          style={[
            styles.wordmark,
            {
              fontSize: text,
            },
          ]}
        >
          Nara
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mark: {
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  dot: {
    backgroundColor: colors.accent,
  },
  wordmark: {
    fontFamily: fontFamily.grotesk,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
  },
});
