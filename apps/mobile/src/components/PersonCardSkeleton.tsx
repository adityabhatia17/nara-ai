/**
 * PersonCardSkeleton — Placeholder that matches PersonCard layout.
 * Square avatar left, 2 text lines right.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from './Skeleton';

export function PersonCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Avatar */}
      <Skeleton width={46} height={46} borderRadius={13} />

      {/* Text block */}
      <View style={styles.content}>
        <Skeleton width={120} height={14} borderRadius={4} />
        <Skeleton width={180} height={11} borderRadius={4} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 14,
  },
  content: {
    flex: 1,
  },
});
