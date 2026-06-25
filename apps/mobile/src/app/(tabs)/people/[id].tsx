/**
 * Person Detail Screen — People > [id]
 * Full timeline of notes mentioning this person with tone indicators.
 *
 * Layout:
 * - "‹ People" back nav (meta, subInk)
 * - 78px rounded-square avatar + name (display 700) + mention count (meta, faint)
 * - Timeline FlatList:
 *   - Absolute 1.5px vertical connector line
 *   - Per entry: colored dot (10px circle) at line, date eyebrow, TonePill, note body
 *   - Tap entry → /notes/[note_id]
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  colors,
  typography,
  spacing,
  radius,
  getCategoryColor,
  fontFamily,
} from '@/theme/tokens';
import { api } from '@/lib/api';
import { Entity, EntityTimelineItem } from '@nara/shared';
import { TonePill } from '@/components/tone-pill';

// ─── Tone colour mapping ──────────────────────────────────────────────────────

const TONE_DOT_COLOR: Record<string, string> = {
  positive: '#1B9C77',
  neutral: '#9A9DA1',
  negative: '#D24E6E',
};

function toneColor(tone: string): string {
  return TONE_DOT_COLOR[tone] ?? TONE_DOT_COLOR.neutral;
}

// ─── Date label helper ────────────────────────────────────────────────────────

/**
 * Produces an eyebrow-style label for a date:
 *   Today / Yesterday / Last week / Two weeks ago / Mid-month / Month name Year
 */
function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'Last week';
  if (diffDays < 14) return 'Two weeks ago';

  // Same month: "Early / Mid / Late month"
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  ) {
    const day = date.getDate();
    if (day <= 10) return 'Early this month';
    if (day <= 20) return 'Mid-month';
    return 'Late this month';
  }

  // Older: "June 2026"
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

interface TimelineEntryProps {
  item: EntityTimelineItem;
  isLast: boolean;
  onPress: () => void;
}

function TimelineEntry({ item, isLast, onPress }: TimelineEntryProps) {
  const dotColor = toneColor(item.tone);
  const BODY_LINE_HEIGHT = typography.body.fontSize * (typography.body.lineHeight as number);

  return (
    <TouchableOpacity
      style={styles.entryRow}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Left gutter: vertical line + dot */}
      <View style={styles.gutter}>
        {/* Line — full height, faint */}
        {!isLast && <View style={styles.connectorLine} />}
        {/* Dot — 10px circle, tone-colored */}
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
      </View>

      {/* Entry content */}
      <View style={styles.entryContent}>
        {/* Date eyebrow */}
        <Text style={styles.dateLabel}>
          {formatDateLabel(item.date)}
        </Text>

        {/* Tone pill */}
        <TonePill tone={item.tone} />

        {/* Note body */}
        <Text
          style={[styles.noteText, { lineHeight: BODY_LINE_HEIGHT }]}
        >
          {item.content}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: person, isLoading, error } = useQuery({
    queryKey: ['entity', id],
    queryFn: async () => {
      if (!id) throw new Error('No person ID provided');
      const response = await api.get<Entity>(`/entities/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const initial = person?.name.charAt(0).toUpperCase() ?? '?';
  const avatarBg = getCategoryColor('person', 'tint');
  const avatarColor = getCategoryColor('person', 'base');

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────

  if (error || !person) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <TouchableOpacity style={styles.backNav} onPress={() => router.back()}>
          <Text style={styles.backNavText}>‹ People</Text>
        </TouchableOpacity>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Couldn't load person details.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Layout ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Back nav */}
      <TouchableOpacity
        style={styles.backNav}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.backNavText}>‹ People</Text>
      </TouchableOpacity>

      {/* Person header */}
      <View style={styles.personHeader}>
        <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
          <Text style={[styles.avatarInitial, { color: avatarColor }]}>
            {initial}
          </Text>
        </View>
        <View style={styles.personMeta}>
          <Text style={styles.personName}>{person.name}</Text>
          <Text style={styles.personCount}>
            {person.mention_count} mention{person.mention_count !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Timeline */}
      {person.timeline.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            No notes found for {person.name}
          </Text>
        </View>
      ) : (
        <FlatList<EntityTimelineItem>
          data={person.timeline}
          keyExtractor={(item, index) => `${item.note_id}-${index}`}
          renderItem={({ item, index }) => (
            <TimelineEntry
              item={item}
              isLast={index === person.timeline.length - 1}
              onPress={() => router.push(`/notes/${item.note_id}`)}
            />
          )}
          contentContainerStyle={styles.timelineContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const DOT_SIZE = 10;
const LINE_WIDTH = 1.5;
const GUTTER_WIDTH = 28; // dot (10) + gap to content

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  // ─── Back nav ────────────────────────────────────────────────────────────
  backNav: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  backNavText: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.meta.fontSize,
    fontWeight: '500',
    color: colors.subInk,
  },

  // ─── Person header ────────────────────────────────────────────────────────
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  avatar: {
    width: 78,
    height: 78,
    borderRadius: radius.avatar,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.grotesk,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.9,
  },
  personMeta: {
    flex: 1,
    gap: spacing.xs,
  },
  personName: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.display.fontSize,
    fontWeight: '700',
    letterSpacing: typography.display.letterSpacing,
    color: colors.ink,
  },
  personCount: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.meta.fontSize,
    fontWeight: '500',
    color: colors.faint,
  },

  divider: {
    height: 1,
    backgroundColor: colors.border.card,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },

  // ─── Timeline ─────────────────────────────────────────────────────────────
  timelineContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.tabBar,
  },
  entryRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },

  // Left gutter: holds dot and vertical line
  gutter: {
    width: GUTTER_WIDTH,
    alignItems: 'center',
    position: 'relative',
    marginRight: spacing.lg,
  },
  connectorLine: {
    position: 'absolute',
    top: DOT_SIZE + 4,
    bottom: -spacing.xxl, // extends to next entry's dot
    width: LINE_WIDTH,
    backgroundColor: colors.faint,
    opacity: 0.3,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2, // perfect circle
    marginTop: 2, // optical align with date eyebrow
  },

  // Entry text block
  entryContent: {
    flex: 1,
    gap: spacing.sm,
  },
  dateLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.eyebrow.fontSize,
    fontWeight: '600',
    letterSpacing: typography.eyebrow.letterSpacing,
    textTransform: 'uppercase',
    color: colors.faint,
  },
  noteText: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.body,
  },

  // ─── Utility states ────────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.subInk,
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.grotesk,
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: '#DC2626',
    textAlign: 'center',
  },
});
