/**
 * Canonical NoteCard — used everywhere (Home, Feed, Reveal).
 *
 * Design (Nara.dc.html lines 78-95, FEED card):
 *   Container: bg #FFFFFF, border 1px rgba(20,22,24,0.07), borderRadius 14,
 *              padding 14px vertical / 16px horizontal.
 *              Pressable (activeOpacity 0.85) when onPress provided.
 *   Meta row (row, center, gap 8, mb 8):
 *     - Category dot 7x7 borderRadius 2 (rounded square, NOT circle)
 *     - Label 11.5px weight 600 letterSpacing 0.4 uppercase, getCategoryColor
 *     - Flex spacer
 *     - Time 11.5px color #9A9DA1
 *   Body: 15px weight 500 lineHeight 21.75 (15*1.45) color #26282B.
 *         NO truncation (no numberOfLines / ellipsizeMode).
 */

import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import type { Note } from '@nara/shared';
import { colors, fontFamily, getCategoryColor } from '@/theme/tokens';
import { formatRelativeTime } from '@/lib/date-utils';

interface NoteCardProps {
  note: Note;
  onPress?: () => void;
  style?: ViewStyle;
}

export function NoteCard({ note, onPress, style }: NoteCardProps) {
  const firstCategory = note.categories.length > 0 ? note.categories[0] : null;
  const catColor = firstCategory ? getCategoryColor(firstCategory.name, 'base') : colors.faint;

  const content = (
    <>
      {/* Meta row: category + timestamp */}
      <View style={styles.metaRow}>
        {firstCategory && (
          <>
            <View
              style={[styles.categoryDot, { backgroundColor: catColor }]}
            />
            <Text style={[styles.categoryLabel, { color: catColor }]}>
              {firstCategory.name}
            </Text>
          </>
        )}
        <View style={styles.spacer} />
        <Text style={styles.timestamp}>
          {formatRelativeTime(new Date(note.created_at))}
        </Text>
      </View>

      {/* Body — never truncated */}
      <Text style={styles.body}>{note.content}</Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.card, style]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, style]}>{content}</View>;
}

export default NoteCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
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
  body: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 15 * 1.45,
    color: '#26282B',
  },
});
