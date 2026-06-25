/**
 * TonePill Component
 * Rounded pill with tone indicator ("positive" | "neutral" | "negative")
 * Maps to corresponding color/tint from design system
 */

import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme/tokens';

type ToneType = 'positive' | 'neutral' | 'negative';

interface TonePillProps {
  tone: ToneType;
  label?: string;
  style?: ViewStyle;
}

const toneColors: Record<ToneType, { bg: string; text: string }> = {
  positive: {
    bg: colors.category.person.tint, // Teal tint as positive
    text: colors.category.person.base,
  },
  neutral: {
    bg: colors.border.card,
    text: colors.subInk,
  },
  negative: {
    bg: colors.category.family.tint, // Rose tint as negative
    text: colors.category.family.base,
  },
};

export function TonePill({ tone, label, style }: TonePillProps) {
  const toneColor = toneColors[tone];
  const displayLabel = label || tone.charAt(0).toUpperCase() + tone.slice(1);

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: toneColor.bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: toneColor.text },
        ]}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight as any,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: 'SchibstedGrotesk',
  },
});
