/**
 * Reveal Screen
 *
 * Full-screen route (no tab bar, no status bar).
 * Receives { entryId, noteIds (JSON), transcript } from navigation params.
 *
 * Layout (pixel-matched to Nara.dc.html REVEAL block):
 *  1. Eyebrow "From what you said" — 11.5px 600 uppercase faint
 *  2. Quote block — left cobalt border, italic secondary text
 *  3. "Nara made N notes." — 25px 700, ink
 *  4. N NoteCards — fadeUp staggered at 50/180/310/440ms
 *  5. CTA — full-width ink button, fadeUp at 600ms
 *
 * Data:
 *  - noteIds decoded from JSON string param
 *  - Each note fetched via GET /notes/:id (useQueries)
 *
 * Edge cases:
 *  - Empty noteIds → show a graceful empty state
 *  - Individual note fetch failure → skip that card, not a fatal error
 */

import { StatusBar, View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, fontFamily } from '@/theme/tokens';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useFadeUp } from '@/hooks/animations';
import { NoteCard } from '@/components/note-card';
import type { NoteDetail } from '@nara/shared';

// ── Stagger delays (ms) matching Nara.dc.html ───────────────────────────────
const CARD_DELAYS = [50, 180, 310, 440];
const CTA_DELAY = 600;

// ── Animated NoteCard wrapper ─────────────────────────────────────────────────
function AnimatedNoteCard({ note, index }: { note: NoteDetail; index: number }) {
  const { reduceMotion } = useReduceMotion();
  const delayMs = CARD_DELAYS[index] ?? 440 + (index - 3) * 130;
  const fadeUpStyle = useFadeUp(index, reduceMotion, delayMs);

  return (
    <Animated.View style={fadeUpStyle}>
      <NoteCard note={note} />
    </Animated.View>
  );
}

// ── Animated CTA wrapper ─────────────────────────────────────────────────────
function AnimatedCTA({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { reduceMotion } = useReduceMotion();
  const fadeUpStyle = useFadeUp(0, reduceMotion, CTA_DELAY);

  return (
    <Animated.View style={fadeUpStyle}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.ctaButton,
          pressed && { opacity: 0.88 },
        ]}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="See notes in your feed"
      >
        <Text style={styles.ctaLabel}>See them in your feed</Text>
      </Pressable>
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
          {/* ── Eyebrow ────────────────────────────────────────────── */}
          <Text style={styles.eyebrow}>From what you said</Text>

          {/* ── Quote block ─────────────────────────────────────────── */}
          {!!transcript && (
            <View style={styles.quoteBlock}>
              <Text style={styles.quoteText}>{transcript}</Text>
            </View>
          )}

          {/* ── Loading shimmer ─────────────────────────────────────── */}
          {isLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.waveform} />
              <Text style={styles.loadingText}>Fetching notes…</Text>
            </View>
          )}

          {/* ── Empty state ────────────────────────────────────────── */}
          {!isLoading && noteIds.length === 0 && (
            <Text style={styles.emptyText}>
              Nara didn't find anything to save from that. Try saying more next time.
            </Text>
          )}

          {/* ── "Nara made N notes." + cards ────────────────────────── */}
          {notes.length > 0 && (
            <>
              <Text style={styles.notesHeading}>
                Nara made {notes.length} {notes.length === 1 ? 'note' : 'notes'}.
              </Text>

              <View style={styles.cardsStack}>
                {notes.map((note, i) => (
                  <AnimatedNoteCard key={note.id} note={note} index={i} />
                ))}
              </View>

              {/* ── CTA ─────────────────────────────────────────────── */}
              <AnimatedCTA onPress={handleSeeInFeed} disabled={isLoading} />
            </>
          )}
        </ScrollView>
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
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 122,
  },

  // Eyebrow "From what you said"
  eyebrow: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.faint,
    marginBottom: 12,
  },

  // Quote block
  quoteBlock: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: 15,
    marginBottom: 28,
  },
  quoteText: {
    fontFamily: fontFamily.grotesk,
    fontStyle: 'italic',
    fontSize: 15.5,
    fontWeight: '400',
    lineHeight: 15.5 * 1.6,
    color: colors.secondary,
  },

  // Loading
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '500',
    color: colors.subInk,
  },

  // Empty state
  emptyText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 15 * 1.45,
    color: colors.subInk,
    marginTop: 16,
  },

  // "Nara made N notes."
  notesHeading: {
    fontFamily: fontFamily.grotesk,
    fontSize: 25,
    fontWeight: '700',
    letterSpacing: -0.6,
    color: colors.ink,
    marginBottom: 20,
  },

  // Cards
  cardsStack: {
    gap: 11,
  },

  // CTA
  ctaButton: {
    marginTop: 28,
    backgroundColor: colors.ink,
    borderRadius: 13,
    padding: 16,
    alignItems: 'center',
  },
  ctaLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '600',
    color: colors.paper,
  },
});
