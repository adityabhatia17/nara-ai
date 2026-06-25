/**
 * Nudges Modal — full-screen dark overlay (#121316)
 *
 * Design spec (§9, §10 Rule #8):
 * - Dark lockscreen background — Home remains visible behind (modal presentation)
 * - "From Nara" in display/700/white at top
 * - FlatList of nudge cards: white bg, 14px radius
 *   - Left: NaraLogo mark (24×24 ink square + cobalt dot)
 *   - Body text (14.5px / 500 / ink)
 *   - Timestamp (11.5px / faint)
 *   - Dismiss action (text-only faint) → POST /nudges/:id/dismiss
 * - "Close" secondary-style button at bottom → dismisses the modal
 */

import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { colors, radius, spacing, typography } from '@/theme/tokens';
import { api } from '@/lib/api';
import type { Nudge, NudgesListResponse, DismissNudgeResponse } from '@nara/shared';

// ---------------------------------------------------------------------------
// Nara mark — 24px ink rounded square with a 6px cobalt dot (bottom-right)
// ---------------------------------------------------------------------------
function NaraMark() {
  return (
    <View style={styles.markContainer}>
      <View style={styles.markSquare} />
      <View style={styles.markDot} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single nudge card
// ---------------------------------------------------------------------------
interface NudgeCardProps {
  nudge: Nudge;
  onDismiss: (id: string) => void;
  dismissing: boolean;
}

function NudgeCard({ nudge, onDismiss, dismissing }: NudgeCardProps) {
  const createdAt = new Date(nudge.created_at);
  const timeLabel = createdAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardRow}>
        <NaraMark />
        <View style={styles.cardBody}>
          <Text style={styles.cardText}>{nudge.content}</Text>
          <Text style={styles.cardMeta}>{timeLabel}</Text>
        </View>
      </View>
      <Pressable
        onPress={() => onDismiss(nudge.id)}
        disabled={dismissing}
        style={({ pressed }) => [
          styles.dismissButton,
          pressed && styles.dismissButtonPressed,
        ]}
      >
        <Text style={styles.dismissText}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function NudgesModalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['nudges'],
    queryFn: async () => {
      const response = await api.get<NudgesListResponse>('/nudges?limit=10');
      return response.data;
    },
  });

  const { mutate: dismiss, variables: dismissingId } = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.post<DismissNudgeResponse>(
        `/nudges/${id}/dismiss`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
    },
  });

  const nudges = data?.nudges ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>From Nara</Text>
        <Text style={styles.subtitle}>Things worth remembering</Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colors.card} />
        </View>
      ) : isError ? (
        <View style={styles.centred}>
          <Text style={styles.errorText}>Could not load nudges.</Text>
        </View>
      ) : nudges.length === 0 ? (
        <View style={styles.centred}>
          <Text style={styles.emptyText}>Nothing new from Nara right now.</Text>
        </View>
      ) : (
        <FlatList
          data={nudges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <NudgeCard
              nudge={item}
              onDismiss={dismiss}
              dismissing={dismissingId === item.id}
            />
          )}
        />
      )}

      {/* Close button */}
      <View style={styles.footer}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <Text style={styles.closeText}>Close</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const MARK_SIZE = 24;
const DOT_SIZE = 7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.lockscreen,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.display.fontSize,
    fontWeight: '700',
    color: colors.card,
    letterSpacing: typography.display.letterSpacing,
    fontFamily: 'SchibstedGrotesk_700Bold',
  },
  subtitle: {
    fontSize: typography.meta.fontSize,
    fontWeight: '500',
    color: colors.faint,
    fontFamily: 'SchibstedGrotesk_500Medium',
  },
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorText: {
    fontSize: typography.body.fontSize,
    color: colors.faint,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: typography.body.fontSize,
    color: colors.faint,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  // Card
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  cardBody: {
    flex: 1,
    gap: spacing.xs,
  },
  cardText: {
    fontSize: 14.5,
    fontWeight: '500',
    color: colors.ink,
    lineHeight: 14.5 * 1.45,
    fontFamily: 'SchibstedGrotesk_500Medium',
  },
  cardMeta: {
    fontSize: typography.meta.fontSize,
    fontWeight: '500',
    color: colors.faint,
    fontFamily: 'SchibstedGrotesk_400Regular',
  },
  dismissButton: {
    alignSelf: 'flex-end',
  },
  dismissButtonPressed: {
    opacity: 0.6,
  },
  dismissText: {
    fontSize: typography.meta.fontSize,
    fontWeight: '500',
    color: colors.faint,
    fontFamily: 'SchibstedGrotesk_500Medium',
  },
  // Nara mark
  markContainer: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    position: 'relative',
  },
  markSquare: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: radius.mark,
    backgroundColor: colors.ink,
  },
  markDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.circle,
    backgroundColor: colors.accent,
    position: 'absolute',
    bottom: -2,
    right: -2,
  },
  // Footer close button — secondary style (white text, dark outline)
  footer: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
  },
  closeButton: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  closeButtonPressed: {
    opacity: 0.75,
  },
  closeText: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.card,
    fontFamily: 'SchibstedGrotesk_600SemiBold',
  },
});
