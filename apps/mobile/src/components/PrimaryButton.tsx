/**
 * PrimaryButton Component
 * Ink background, white text, 14px label weight 600, rounded pill
 * Full-width by default, scales with press state
 */

import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, typography, spacing } from '@/theme/tokens';

interface PrimaryButtonProps {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function PrimaryButton({
  onPress,
  label,
  disabled = false,
  style,
}: PrimaryButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.ink,
    borderRadius: radius.card, // 14px per spec
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'SchibstedGrotesk',
  },
});
