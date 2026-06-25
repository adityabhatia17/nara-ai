/**
 * Metadata Component
 * Small meta text — timestamps, counts, secondary info
 * 11.5px, 500 weight, faint color
 */

import { Text, TextProps, StyleSheet } from 'react-native';
import { typography, colors } from '@/theme/tokens';

interface MetadataProps extends TextProps {
  children: string;
}

export function Metadata({ style, ...props }: MetadataProps) {
  return (
    <Text
      style={[styles.meta, style]}
      {...props}
    >
      {props.children}
    </Text>
  );
}

const styles = StyleSheet.create({
  meta: {
    fontSize: typography.meta.fontSize,
    fontWeight: typography.meta.fontWeight as any,
    letterSpacing: 0,
    lineHeight: typography.meta.lineHeight * typography.meta.fontSize,
    color: colors.faint,
    fontFamily: 'SchibstedGrotesk',
  },
});
