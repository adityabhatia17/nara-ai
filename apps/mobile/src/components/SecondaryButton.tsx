/**
 * SecondaryButton Component
 * White background, ink text, hairline border, 14px label weight 600
 * Quiet alternative to primary button
 */

import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, spacing } from '@/theme/tokens';

interface SecondaryButtonProps {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function SecondaryButton({
  onPress,
  label,
  disabled = false,
  style,
}: SecondaryButtonProps) {
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
    backgroundColor: colors.card,
    borderRadius: radius.card, // 14px per spec
    borderColor: colors.border.card,
    borderWidth: 1,
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
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'SchibstedGrotesk',
  },
});
