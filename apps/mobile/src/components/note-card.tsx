/**
 * Note Card (named export variant)
 * Used by Home screen recents. Same visual as NoteCard.tsx.
 *
 * Design (from Nara.dc.html lines 78-95):
 *   Card: white bg, 14px radius, 1px border rgba(20,22,24,0.07), padding 14px 16px
 *   Category row: 7px dot (2px radius) + 11.5px label (600, 0.4px tracking, uppercase)
 *                 + flex spacer + 11.5px timestamp (#9A9DA1)
 *   Gap between category row and body: 8px
 *   Body: 15px, weight 500, line-height 1.45, color #26282B
 *   NO numberOfLines. NO ellipsis.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Note } from '@nara/shared';
import { colors, radius, spacing, fontFamily, getCategoryColor } from '@/theme/tokens';
import { formatRelativeTime } from '@/lib/date-utils';

interface NoteCardProps {
  note: Note;
}

export function NoteCard({ note }: NoteCardProps) {
  const firstCategory = note.categories.length > 0 ? note.categories[0] : null;
  const catColor = firstCategory ? getCategoryColor(firstCategory.name, 'base') : colors.faint;

  return (
    <View style={styles.card}>
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

        <Text style={styles.timestamp}>
          {formatRelativeTime(new Date(note.created_at))}
        </Text>
      </View>

      {/* Content -- never truncate */}
      <Text style={styles.content}>
        {note.content}
      </Text>
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
