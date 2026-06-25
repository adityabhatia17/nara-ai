/**
 * SectionHeader Component
 * Displays section titles in lists (grouped by day, category, or person).
 *
 * Design (from Nara.dc.html line 181):
 *   11.5px, weight 600, 0.6px tracking, uppercase, #9A9DA1
 *   margin: 14px top, 11px bottom
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme/tokens';

interface SectionHeaderProps {
  title: string;
}

export default function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    marginTop: 14,
    marginBottom: 11,
  },
  title: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#9A9DA1',
  },
});
