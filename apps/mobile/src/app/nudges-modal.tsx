/**
 * Nudges Modal — full-screen dark overlay (#121316)
 *
 * Pixel-matched to Nara.dc.html NUDGES block:
 * - Dark lockscreen background — Home remains visible behind (modal presentation)
 * - Header: date line + clock (lockscreen-style, centered)
 * - Nudge cards: white bg, 18px radius, NARA label + time header row, body text
 *   - Left: 24×24 ink rounded square with centered 7px cobalt dot
 * - "Close" pill button at bottom of list → dismisses the modal
 */

import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { colors } from '@/theme/tokens';
import { api } from '@/lib/api';
import type { Nudge, NudgesListResponse, DismissNudgeResponse } from '@nara/shared';

// ---------------------------------------------------------------------------
// Nara mark — 24px ink rounded square with a centered 7px cobalt dot
// ---------------------------------------------------------------------------
function NaraMark() {
  return (
    <View style={markStyles.square}>
      <View style={markStyles.dot} />
    </View>
  );
}

const markStyles = StyleSheet.create({
  square: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#18191B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: '#2E50E6',
  },
});

// ---------------------------------------------------------------------------
// Single nudge card
// ---------------------------------------------------------------------------
interface NudgeCardProps {
  nudge: Nudge;
  onPress: (nudge: Nudge) => void;
}

function NudgeCard({ nudge, onPress }: NudgeCardProps) {
  const createdAt = new Date(nudge.created_at);
  const timeLabel = createdAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <Pressable
      onPress={() => onPress(nudge)}
      style={({ pressed }) => [
        cardStyles.card,
        pressed && { opacity: 0.85 },
      ]}
    >
      <NaraMark />
      <View style={cardStyles.body}>
        <View style={cardStyles.headerRow}>
          <Text style={cardStyles.naraLabel}>NARA</Text>
          <Text style={cardStyles.time}>{timeLabel}</Text>
        </View>
        <Text style={cardStyles.text}>{nudge.content}</Text>
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  naraLabel: {
    fontFamily: 'SchibstedGrotesk_700Bold',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: '#18191B',
    textTransform: 'uppercase',
  },
  time: {
    fontFamily: 'SchibstedGrotesk_400Regular',
    fontSize: 11.5,
    color: '#8A8E93',
  },
  text: {
    fontFamily: 'SchibstedGrotesk_500Medium',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: Math.round(14.5 * 1.42),
    color: '#26282B',
  },
});

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

  const { mutate: dismiss } = useMutation({
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

  // Format current date & time for lockscreen header
  const now = useMemo(() => new Date(), []);
  const dateLine = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const clockLine = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  });

  const handleNudgePress = (nudge: Nudge) => {
    // Could navigate to a detail or start a recording; for now dismiss
    dismiss(nudge.id);
  };

  return (
    <View style={styles.container}>
      {/* Header — lockscreen-style date + clock */}
      <View style={styles.header}>
        <Text style={styles.dateLine}>{dateLine}</Text>
        <Text style={styles.clock}>{clockLine}</Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centred}>
          <ActivityIndicator size="large" color={colors.card} />
        </View>
      ) : isError ? (
        <View style={styles.centred}>
          <Text style={styles.emptyText}>Could not load nudges.</Text>
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
            <NudgeCard nudge={item} onPress={handleNudgePress} />
          )}
          ListFooterComponent={
            <View style={styles.closeWrapper}>
              <Pressable
                onPress={() => router.back()}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.closeText}>Close</Text>
              </Pressable>
            </View>
          }
        />
      )}

      {/* Close button for empty / error states */}
      {(isError || nudges.length === 0 || isLoading) ? null : null}
      {!isLoading && (isError || nudges.length === 0) && (
        <View style={styles.closeWrapper}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121316',
  },
  // Header — lockscreen-style
  header: {
    paddingTop: 72,
    paddingHorizontal: 26,
    paddingBottom: 18,
    alignItems: 'center',
  },
  dateLine: {
    fontFamily: 'SchibstedGrotesk_500Medium',
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(243,243,241,0.5)',
    letterSpacing: 0.5,
  },
  clock: {
    fontFamily: 'SchibstedGrotesk_600SemiBold',
    fontSize: 62,
    fontWeight: '600',
    color: '#F3F3F1',
    lineHeight: 62,
    marginTop: 4,
    letterSpacing: -1,
  },
  // Content
  centred: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 26,
  },
  emptyText: {
    fontFamily: 'SchibstedGrotesk_500Medium',
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(243,243,241,0.5)',
    textAlign: 'center',
  },
  listContent: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 9,
  },
  // Close button — pill, centered
  closeWrapper: {
    alignItems: 'center',
    marginTop: 14,
  },
  closeButton: {
    paddingVertical: 11,
    paddingHorizontal: 26,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(243,243,241,0.25)',
  },
  closeText: {
    fontFamily: 'SchibstedGrotesk_500Medium',
    fontSize: 13.5,
    fontWeight: '500',
    color: 'rgba(243,243,241,0.8)',
  },
});
