/**
 * Processing Screen
 *
 * Full-screen route (no tab bar, no status bar).
 * Receives { entryId } from navigation params.
 *
 * Flow:
 *  1. Show breathing NaraLogo + "Sorting what you said…" subtitle.
 *  2. Poll GET /entries/:id/status every 1.5s via TanStack Query.
 *  3. status=done  → navigate to /reveal with { entryId, noteIds, transcript }.
 *  4. status=failed → show error message + back button.
 *
 * Spec: docs/CLAUDE_FRONTEND.md § Screen 3 "Processing"
 */

import { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, typography, spacing, radius, fontFamily } from '@/theme/tokens';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useBreathe } from '@/hooks/animations';
import type { EntryStatusResponse } from '@nara/shared';
import { useAppStore } from '@/store/app';

// ── Nara Logo (ink square + cobalt circle-dot) ───────────────────────────────
// 58px as spec says "58px" for this screen context.
function NaraLogo({ size = 58 }: { size?: number }) {
  const { reduceMotion } = useReduceMotion();
  const breatheStyle = useBreathe(reduceMotion);

  return (
    <Animated.View style={[breatheStyle, { width: size, height: size }]}>
      {/* Ink square (Nara mark) */}
      <View
        style={[
          styles.markSquare,
          { width: size, height: size, borderRadius: Math.round(size / 8) },
        ]}
      >
        {/* Cobalt circle dot — bottom-right corner */}
        <View style={styles.markDot} />
      </View>
    </Animated.View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function ProcessingScreen() {
  const router = useRouter();
  const { setRecordingState } = useAppStore();
  const { entryId } = useLocalSearchParams<{ entryId: string }>();

  // Poll entry status
  const { data, isError, error } = useQuery({
    queryKey: ['entry-status', entryId],
    queryFn: async () => {
      if (!entryId) throw new Error('No entry ID');
      const res = await api.get<EntryStatusResponse>(`/entries/${entryId}/status`);
      return res.data;
    },
    // Keep polling while status is pending / processing
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 1500;
      if (d.status === 'done' || d.status === 'failed') return false;
      return 1500;
    },
    enabled: !!entryId,
    // Retry network failures up to 3 times; don't retry 404/failed statuses
    retry: (failureCount, err) => {
      if (err instanceof Error && err.message === 'not_found') return false;
      return failureCount < 3;
    },
  });

  // Navigate once done
  useEffect(() => {
    if (!data) return;

    if (data.status === 'done') {
      setRecordingState('idle');
      router.replace({
        pathname: '/reveal',
        params: {
          entryId: data.entry_id,
          noteIds: JSON.stringify(data.note_ids),
          transcript: data.transcript,
        },
      });
    }
  }, [data, router, setRecordingState]);

  const isFailed = data?.status === 'failed';
  const failureReason =
    isFailed && 'error' in data ? data.error : undefined;

  const handleGoBack = () => {
    setRecordingState('idle');
    router.back();
  };

  return (
    <>
      <StatusBar hidden />
      <View style={styles.container}>

        {/* ── Breathing logo ─────────────────────────────────────────── */}
        <Animated.View entering={FadeIn} style={styles.logoWrapper}>
          <NaraLogo size={58} />
        </Animated.View>

        {/* ── Subtitle ────────────────────────────────────────────────── */}
        <Animated.View entering={FadeIn.delay(150)} style={styles.subtitleWrapper}>
          {isFailed ? (
            <>
              <Text style={[styles.subtitle, styles.errorText]}>
                {failureReason ?? 'Something went wrong.'}
              </Text>
              <Pressable
                onPress={handleGoBack}
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
                accessibilityRole="button"
              >
                <Text style={styles.backLabel}>Go back</Text>
              </Pressable>
            </>
          ) : isError ? (
            <>
              <Text style={[styles.subtitle, styles.errorText]}>
                {error instanceof Error ? error.message : 'Could not reach server.'}
              </Text>
              <Pressable
                onPress={handleGoBack}
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.75 }]}
                accessibilityRole="button"
              >
                <Text style={styles.backLabel}>Go back</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.subtitle}>Sorting what you said…</Text>
          )}
        </Animated.View>

      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xxl,
  },
  logoWrapper: {},
  markSquare: {
    backgroundColor: colors.ink,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 6,
  },
  markDot: {
    width: 9,
    height: 9,
    borderRadius: radius.circle,
    backgroundColor: colors.accent, // cobalt circle dot
  },
  subtitleWrapper: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  subtitle: {
    fontSize: typography.voice.fontSize,
    fontWeight: '400',
    fontStyle: 'italic',
    color: colors.subInk,
    fontFamily: fontFamily.grotesk,
    textAlign: 'center',
  },
  errorText: {
    fontStyle: 'normal',
    color: '#D24E6E',
  },
  backButton: {
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.interactive as string,
  },
  backLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '500',
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
  },
});
