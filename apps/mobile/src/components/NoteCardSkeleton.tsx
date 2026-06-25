/**
 * NoteCardSkeleton — Placeholder that matches NoteCard layout.
 * Small circle top-left + short text bar, then 2-3 lines of varying width.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { Skeleton } from './Skeleton';

export function NoteCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Category row: dot + short label + spacer + timestamp */}
      <View style={styles.metaRow}>
        <Skeleton width={7} height={7} borderRadius={2} />
        <Skeleton width={60} height={10} borderRadius={4} style={{ marginLeft: 8 }} />
        <View style={styles.spacer} />
        <Skeleton width={40} height={10} borderRadius={4} />
      </View>

      {/* Body lines */}
      <Skeleton width="100%" height={13} borderRadius={4} style={{ marginTop: 10 }} />
      <Skeleton width="85%" height={13} borderRadius={4} style={{ marginTop: 7 }} />
      <Skeleton width="60%" height={13} borderRadius={4} style={{ marginTop: 7 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spacer: {
    flex: 1,
  },
});
