/**
 * ScreenTitle Component
 * Used for screen headers: title + optional subtitle.
 *
 * Design (from Nara.dc.html):
 *   Title:    32px, weight 700, tracking -0.8, color #18191B
 *   Subtitle: 13px, weight 400, color #9A9DA1, margin-top 4px
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme/tokens';

export interface ScreenTitleProps {
  title: string;
  subtitle?: string;
}

export function ScreenTitle({ title, subtitle }: ScreenTitleProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle && (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  title: {
    fontFamily: fontFamily.grotesk,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#18191B',
  },
  subtitle: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '400',
    color: '#9A9DA1',
    marginTop: 4,
  },
});
