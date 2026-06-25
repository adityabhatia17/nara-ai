/**
 * NoteCard Component
 * Universal note card used in Feed, Reveal, Home recents, and Person timeline.
 * One component everywhere for visual consistency.
 *
 * Design (from Nara.dc.html lines 78-95):
 *   Card: white bg, 14px radius, 1px border rgba(20,22,24,0.07), padding 14px 16px
 *   Category row: 7px dot (2px radius) + 11.5px label (600, 0.4px tracking, uppercase, category color)
 *                 + flex spacer + 11.5px timestamp (#9A9DA1)
 *   Gap between category row and body: 8px
 *   Body: 15px, weight 500, line-height 1.45, color #26282B
 *   NO numberOfLines limit. NO ellipsis. Text wraps fully.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, radius, shadow, getCategoryColor, fontFamily } from '@/theme/tokens';
import type { Note } from '@nara/shared';

interface NoteCardProps {
  note: Note;
  onPress?: () => void;
  style?: ViewStyle;
}

export default function NoteCard({ note, onPress, style }: NoteCardProps) {
  const timestamp = formatTimeago(note.created_at);
  const firstCategory = note.categories.length > 0 ? note.categories[0] : null;
  const catColor = firstCategory ? getCategoryColor(firstCategory.name, 'base') : colors.faint;

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Category + timestamp row */}
      <View style={styles.metaRow}>
        {firstCategory && (
          <View style={styles.categoryBadge}>
            <View
              style={[
                styles.categoryDot,
                { backgroundColor: catColor },
              ]}
            />
            <Text
              style={[
                styles.categoryLabel,
                { color: catColor },
              ]}
            >
              {firstCategory.name}
            </Text>
          </View>
        )}

        <View style={styles.spacer} />

        <Text style={styles.timestamp}>{timestamp}</Text>
      </View>

      {/* Note content -- never truncate (Visual Rule #9) */}
      <Text style={styles.content}>
        {note.content}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Format timestamp: "2d ago", "1h ago", or date if > 7 days
 */
function formatTimeago(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = diff / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;

    if (days < 1) {
      if (hours < 1) return '< 1h';
      return `${Math.floor(hours)}h ago`;
    }

    if (days < 7) {
      return `${Math.floor(days)}d ago`;
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return 'unknown';
  }
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
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 2,
  },
  categoryLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  spacer: {
    flex: 1,
  },
  timestamp: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '400',
    color: '#9A9DA1',
  },
  content: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 15 * 1.45,
    color: '#26282B',
  },
});
