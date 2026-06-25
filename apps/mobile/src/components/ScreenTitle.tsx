/**
 * ScreenTitle Component
 * Display-level heading — Schibsted Grotesk 32px bold
 * Used for main screen titles (Your notes, Ask Nara, People)
 */

import { Text, TextProps, StyleSheet } from 'react-native';
import { typography, colors } from '@/theme/tokens';

interface ScreenTitleProps extends TextProps {
  children: string;
}

export function ScreenTitle({ style, ...props }: ScreenTitleProps) {
  return (
    <Text
      style={[styles.title, style]}
      {...props}
    >
      {props.children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.display.fontSize,
    fontWeight: typography.display.fontWeight as any,
    letterSpacing: typography.display.letterSpacing,
    lineHeight: typography.display.lineHeight * typography.display.fontSize,
    color: colors.ink,
    fontFamily: 'SchibstedGrotesk',
  },
});
