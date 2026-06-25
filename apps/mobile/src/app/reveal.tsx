/**
 * Reveal Screen
 *
 * Full-screen route (no tab bar, no status bar).
 * Receives { entryId, noteIds (JSON), transcript } from navigation params.
 *
 * Layout:
 *  1. "From what you said"  — title (23px, 700, tracking -0.4)
 *  2. Quote block           — verbatim transcript in white card, left cobalt border
 *  3. "Nara made N notes."  — title (23px, 700)
 *  4. N NoteCards           — fadeUp stagger (130ms per card)
 *  5. CTA                   — full-width ink button "See them in your feed"
 *
 * Data:
 *  - noteIds decoded from JSON string param
 *  - Each note fetched via GET /notes/:id (useQueries)
 *
 * Edge cases:
 *  - Empty noteIds → show a graceful empty state
 *  - Individual note fetch failure → skip that card, not a fatal error
 *
 * Spec: docs/CLAUDE_FRONTEND.md § Screen 4 "Reveal"
 */

import { StatusBar, View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, typography, spacing, radius, fontFamily } from '@/theme/tokens';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useFadeUp } from '@/hooks/animations';
import { NoteCard } from '@/components/note-card';
import type { NoteDetail } from '@nara/shared';

// ── Animated NoteCard wrapper ─────────────────────────────────────────────────
function AnimatedNoteCard({ note, index }: { note: NoteDetail; index: number }) {
  const { reduceMotion } = useReduceMotion();
  const fadeUpStyle = useFadeUp(index, reduceMotion);

  return (
    <Animated.View style={fadeUpStyle}>
      <NoteCard note={note} />
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function RevealScreen() {
  const router = useRouter();

  const {
    noteIds: noteIdsParam,
    transcript,
  } = useLocalSearchParams<{
    entryId: string;
    noteIds: string;
    transcript: string;
  }>();

  // Decode noteIds from JSON string (passed via router params)
  let noteIds: string[] = [];
  try {
    if (noteIdsParam) {
      noteIds = JSON.parse(noteIdsParam) as string[];
    }
  } catch {
    noteIds = [];
  }

  // Fetch each note in parallel
  const noteQueries = useQueries({
    queries: noteIds.map((id) => ({
      queryKey: ['note', id] as const,
      queryFn: async () => {
        const res = await api.get<NoteDetail>(`/notes/${id}`);
        return res.data;
      },
      // A single note failing shouldn't block the reveal
      retry: 1,
    })),
  });

  const isLoading = noteQueries.some((q) => q.isLoading);
  // Collect successfully fetched notes (skip failures — don't block the screen)
  const notes = noteQueries
    .filter((q) => q.isSuccess && q.data != null)
    .map((q) => q.data as NoteDetail);

  const handleSeeInFeed = () => {
    router.replace('/(tabs)/notes');
  };

  return (
    <>
      <StatusBar hidden />
      <View style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Heading ─────────────────────────────────────────────── */}
          <Animated.Text entering={FadeIn} style={styles.heading}>
            From what you said
          </Animated.Text>

          {/* ── Quote block ─────────────────────────────────────────── */}
          {!!transcript && (
            <Animated.View entering={FadeIn.delay(80)} style={styles.quoteBlock}>
              <Text style={styles.quoteText}>{transcript}</Text>
            </Animated.View>
          )}

          {/* ── Loading shimmer ─────────────────────────────────────── */}
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.waveform} />
              <Text style={styles.loadingText}>Fetching notes…</Text>
            </View>
          )}

          {/* ── "Nara made N notes." + cards ────────────────────────── */}
          {!isLoading && noteIds.length === 0 && (
            <Text style={styles.emptyText}>
              Nara didn't find anything to save from that. Try saying more next time.
            </Text>
          )}

          {notes.length > 0 && (
            <>
              <Animated.Text entering={FadeIn.delay(160)} style={styles.notesHeading}>
                Nara made {notes.length} {notes.length === 1 ? 'note' : 'notes'}.
              </Animated.Text>

              <View style={styles.cardsStack}>
                {notes.map((note, i) => (
                  <AnimatedNoteCard key={note.id} note={note} index={i} />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        {/* ── Full-width CTA ──────────────────────────────────────────── */}
        <View style={styles.ctaContainer}>
          <Pressable
            onPress={handleSeeInFeed}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && { opacity: 0.88 },
            ]}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="See notes in your feed"
          >
            <Text style={styles.ctaLabel}>See them in your feed</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.statusBar,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Heading "From what you said"
  heading: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
    letterSpacing: typography.title.letterSpacing,
    lineHeight: typography.title.fontSize * (typography.title.lineHeight ?? 1.15),
    marginBottom: spacing.xl,
  },

  // Quote block
  quoteBlock: {
    backgroundColor: colors.card,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent, // cobalt #2E50E6
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  quoteText: {
    fontSize: typography.voice.fontSize,
    fontWeight: '400',
    fontStyle: 'italic',
    color: colors.body,
    fontFamily: fontFamily.grotesk,
    lineHeight: typography.voice.fontSize * (typography.voice.lineHeight ?? 1.5),
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.meta.fontSize,
    color: colors.subInk,
    fontFamily: fontFamily.grotesk,
    fontWeight: '500',
  },

  // Empty state
  emptyText: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.subInk,
    fontFamily: fontFamily.grotesk,
    lineHeight: typography.body.fontSize * (typography.body.lineHeight ?? 1.45),
    marginTop: spacing.lg,
  },

  // "Nara made N notes."
  notesHeading: {
    fontSize: typography.title.fontSize,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
    letterSpacing: typography.title.letterSpacing,
    lineHeight: typography.title.fontSize * (typography.title.lineHeight ?? 1.15),
    marginBottom: spacing.lg,
  },

  // Cards
  cardsStack: {
    gap: 0, // NoteCard itself carries bottom margin
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg, // safe-area buffer
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.card as string,
  },
  ctaButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  ctaLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.paper,
    fontFamily: fontFamily.grotesk,
  },
});
