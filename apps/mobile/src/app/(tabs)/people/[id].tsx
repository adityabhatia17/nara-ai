/**
 * Person Detail Screen — People > [id]
 * Full timeline of notes mentioning this person with tone indicators.
 *
 * Layout (from Nara.dc.html PERSON block):
 * - "‹ People" back nav
 * - 54px rounded-square avatar + name (26px 700) + mention count
 * - Summary box (person-tinted bg)
 * - Timeline with vertical connector, tone dots, date eyebrows, tone pills
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  colors,
  getCategoryColor,
  fontFamily,
} from '@/theme/tokens';
import { api } from '@/lib/api';
import { Entity, EntityTimelineItem } from '@nara/shared';
import { TonePill } from '@/components/tone-pill';

// ─── Tone colour mapping ──────────────────────────────────────────────────────

const TONE_COLORS: Record<string, { color: string; tint: string }> = {
  positive: { color: '#1B9C77', tint: '#D7F0E7' },
  neutral: { color: '#9A9DA1', tint: '#E9E9E9' },
  negative: { color: '#D24E6E', tint: '#F8E2E8' },
};

function toneColor(tone: string): string {
  return TONE_COLORS[tone]?.color ?? TONE_COLORS.neutral.color;
}

// ─── Date label helper ────────────────────────────────────────────────────────

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

  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  ) {
    const day = date.getDate();
    if (day <= 10) return 'Early this month';
    if (day <= 20) return 'Mid-month';
    return 'Late this month';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

// ─── Timeline entry ───────────────────────────────────────────────────────────

interface TimelineEntryProps {
  item: EntityTimelineItem;
  onPress: () => void;
}

function TimelineEntry({ item, onPress }: TimelineEntryProps) {
  const dotColor = toneColor(item.tone);

  return (
    <TouchableOpacity
      style={styles.timelineItem}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Dot on the vertical connector */}
      <View
        style={[styles.timelineDot, { backgroundColor: dotColor }]}
      />

      {/* Date + tone pill row */}
      <View style={styles.timelineMetaRow}>
        <Text style={styles.dateLabel}>
          {formatDateLabel(item.date)}
        </Text>
        <TonePill tone={item.tone} />
      </View>

      {/* Note text */}
      <Text style={styles.noteText}>
        {item.content}
      </Text>
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
  const personBase = getCategoryColor('person', 'base');
  const personTint = getCategoryColor('person', 'tint');

  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────

  if (error || !person) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backChevron}>‹</Text>
            <Text style={styles.backLabel}>People</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Couldn't load person details.</Text>
        </View>
      </View>
    );
  }

  // ─── Layout ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header block */}
      <View style={styles.header}>
        {/* Back row */}
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backLabel}>People</Text>
        </TouchableOpacity>

        {/* Identity row */}
        <View style={styles.identityRow}>
          <View style={[styles.avatar, { backgroundColor: personTint }]}>
            <Text style={[styles.avatarInitial, { color: personBase }]}>
              {initial}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.personName}>{person.name}</Text>
            <Text style={styles.personMeta}>
              Mentioned {person.mention_count} time{person.mention_count !== 1 ? 's' : ''} this month
            </Text>
          </View>
        </View>
      </View>

      {/* Body */}
      {person.timeline.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            No notes found for {person.name}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Summary box */}
          <View style={[styles.summaryBox, { backgroundColor: 'rgba(27,156,119,0.1)' }]}>
            <Text style={[styles.summaryText, { color: personBase }]}>
              {person.timeline.length} mention{person.timeline.length !== 1 ? 's' : ''} across your notes.
            </Text>
          </View>

          {/* Timeline wrapper with vertical connector */}
          <View style={styles.timelineWrapper}>
            {/* Vertical connector line */}
            <View style={styles.connectorLine} />

            {person.timeline.map((item, index) => (
              <TimelineEntry
                key={`${item.note_id}-${index}`}
                item={item}
                onPress={() => router.push(`/notes/${item.note_id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const DOT_SIZE = 11;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  // ─── Header ─────────────────────────────────────────────────────────────
  header: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backChevron: {
    fontFamily: fontFamily.grotesk,
    fontSize: 19,
    color: '#6A6E73',
    lineHeight: 19,
  },
  backLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '500',
    color: '#6A6E73',
  },

  // ─── Identity ───────────────────────────────────────────────────────────
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  identityText: {
    flex: 1,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontFamily: fontFamily.grotesk,
    fontSize: 24,
    fontWeight: '600',
  },
  personName: {
    fontFamily: fontFamily.grotesk,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: '#18191B',
  },
  personMeta: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '400',
    color: '#9A9DA1',
    marginTop: 2,
  },

  // ─── Body ───────────────────────────────────────────────────────────────
  bodyContent: {
    paddingTop: 22,
    paddingHorizontal: 24,
    paddingBottom: 122,
  },

  // ─── Summary box ────────────────────────────────────────────────────────
  summaryBox: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  summaryText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 14.5 * 1.5,
  },

  // ─── Timeline ───────────────────────────────────────────────────────────
  timelineWrapper: {
    position: 'relative',
    paddingLeft: 24,
  },
  connectorLine: {
    position: 'absolute',
    left: 5,
    top: 6,
    bottom: 6,
    width: 1.5,
    backgroundColor: 'rgba(20,22,24,0.1)',
  },
  timelineItem: {
    position: 'relative',
    marginBottom: 24,
  },
  timelineDot: {
    position: 'absolute',
    left: -23,
    top: 4,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2.5,
    borderColor: '#F3F3F1',
  },
  timelineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 6,
  },
  dateLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#9A9DA1',
  },
  noteText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15.5,
    fontWeight: '500',
    lineHeight: 15.5 * 1.45,
    color: '#26282B',
  },

  // ─── Utility states ────────────────────────────────────────────────────
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    color: '#4D5560',
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    color: '#DC2626',
    textAlign: 'center',
  },
});
