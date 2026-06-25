/**
 * CategoryPill Component
 * 7px rounded square dot + label in category color
 * Used throughout app for category identification
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, typography, spacing, radius, getCategoryColor } from '@/theme/tokens';

interface CategoryPillProps {
  name: string;
  style?: ViewStyle;
}

export default function CategoryPill({ name, style }: CategoryPillProps) {
  const categoryColor = getCategoryColor(name, 'base');

  return (
    <View style={[styles.container, style]}>
      {/* 7px rounded square dot */}
      <View
        style={[
          styles.dot,
          { backgroundColor: categoryColor },
        ]}
      />
      {/* Category label in same color */}
      <Text style={[styles.label, { color: categoryColor }]}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.dot,
  },
  label: {
    fontSize: typography.label.fontSize,
    fontWeight: typography.label.fontWeight,
    letterSpacing: typography.label.letterSpacing,
    textTransform: 'uppercase',
    fontFamily: 'SchibstedGrotesk',
  },
});
