/**
 * Home Screen -- Talk tab (text capture: "New note" hero)
 *
 * Design (from Nara.dc.html lines 29-97):
 *   Header: NaraLogo (25px mark, 7px radius) + "Nara" (18px, 700, -0.4) gap 9px
 *           Right: time (12.5px, 500, #9A9DA1)
 *   Greeting: 32px, 700, tracking -0.9, ink, margin-bottom 22px
 *   Capture hero: centered, padding 52px top 46px bottom
 *     Button: 118px circle, ink bg, shadow, pencil glyph
 *     "New note" -- 16px, 600, ink, margin-top 24px
 *     Subtitle: "Just start writing. No structure needed." -- 13px, 400, #9A9DA1, margin-top 5px
 *   "Recent" header: flex between, eyebrow left, "All notes" 12.5px 600 cobalt right
 *   Note cards: gap 10px
 */

import { useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';

import { colors, fontFamily } from '@/theme/tokens';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { NaraLogo } from '@/components/nara-logo';
import { NoteCard } from '@/components/note-card';
import { NoteCardSkeleton } from '@/components/NoteCardSkeleton';
import { usePushDown, usePulseRing } from '@/hooks/animations';
import type { MeResponse, NotesListResponse, NudgesListResponse } from '@nara/shared';

// -- Date helpers ------------------------------------------------------------

function formatHeaderTime(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayName = days[date.getDay()];
  let hours = date.getHours();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dayName} · ${hours}:${minutes} ${ampm}`;
}

function getGreeting(date: Date): string {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// -- Nudge banner (animated) -------------------------------------------------

interface NudgeBannerProps {
  content: string;
  onPress: () => void;
}

function NudgeBanner({ content, onPress }: NudgeBannerProps) {
  const reduceMotion = useReducedMotion();
  const animatedStyle = usePushDown(reduceMotion);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={styles.nudgeBanner}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Nara mark icon */}
        <View style={styles.nudgeMark}>
          <View style={styles.nudgeMarkDot} />
        </View>
        <View style={styles.nudgeTextBlock}>
          <Text style={styles.nudgeContent}>{content}</Text>
          <Text style={styles.nudgeMeta}>NARA · just now</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// -- Capture hero ------------------------------------------------------------

function CaptureHero({ onPress }: { onPress: () => void }) {
  const reduceMotion = useReducedMotion();
  const { ring1Style, ring2Style, active } = usePulseRing(reduceMotion);

  return (
    <View style={styles.heroContainer}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.heroTouchable}
      >
        {/* Pulse rings — hidden under reduce-motion */}
        {active && (
          <>
            <Animated.View style={[styles.pulseRing, ring1Style]} />
            <Animated.View style={[styles.pulseRing, ring2Style]} />
          </>
        )}

        {/* Main circle */}
        <View style={styles.heroCircle}>
          {/* Pencil glyph */}
          <View style={styles.pencilWrapper}>
            {/* Body bar — rotated 45deg */}
            <View style={styles.pencilBody} />
            {/* Nib triangle — rotated 45deg, positioned below body */}
            <View style={styles.pencilNib} />
          </View>
        </View>
      </TouchableOpacity>

      <Text style={styles.heroLabel}>New note</Text>
      <Text style={styles.heroSub}>Just start writing. No structure needed.</Text>
    </View>
  );
}

// -- Screen ------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const now = new Date();

  // -- Queries
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await api.get<MeResponse>('/auth/me');
      return res.data;
    },
  });

  const notesQuery = useQuery({
    queryKey: ['notes', { limit: 2 }],
    queryFn: async () => {
      const res = await api.get<NotesListResponse>('/notes', {
        params: { limit: 2 },
      });
      return res.data;
    },
  });

  const nudgesQuery = useQuery({
    queryKey: ['nudges', { limit: 1 }],
    queryFn: async () => {
      const res = await api.get<NudgesListResponse>('/nudges', {
        params: { limit: 1 },
      });
      return res.data;
    },
  });

  // -- Derived state
  const displayName = meQuery.data?.display_name ?? null;
  const greeting = `${getGreeting(now)}, ${displayName ?? 'there'}.`;
  const timeLabel = formatHeaderTime(now);
  const recentNotes = notesQuery.data?.notes ?? [];
  const latestNudge = nudgesQuery.data?.nudges?.[0] ?? null;

  const handleOpenEditor = useCallback(() => {
    router.push('/editor');
  }, [router]);

  const handleOpenNudges = useCallback(() => {
    router.push('/nudges-modal');
  }, [router]);

  const handleAllNotes = useCallback(() => {
    router.push('/(tabs)/notes');
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* -- Header row --------------------------------------------------- */}
        <View style={styles.header}>
          <NaraLogo size="medium" showWordmark />
          <View style={styles.headerRight}>
            <Text style={styles.timeLabel}>{timeLabel}</Text>
            <TouchableOpacity
              onPress={() => {
                Alert.alert('Log out?', 'You will need to sign in again.', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Log out',
                    style: 'destructive',
                    onPress: () => supabase.auth.signOut(),
                  },
                ]);
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.logoutIcon}>
                {/* Door with arrow icon */}
                <View style={styles.logoutDoor} />
                <View style={styles.logoutArrow} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* -- Greeting ----------------------------------------------------- */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting}</Text>
        </View>

        {/* -- Nudge banner (conditional) ----------------------------------- */}
        {latestNudge ? (
          <NudgeBanner
            content={latestNudge.content}
            onPress={handleOpenNudges}
          />
        ) : null}

        {/* -- Capture hero ------------------------------------------------- */}
        <CaptureHero onPress={handleOpenEditor} />

        {/* -- Recent notes ------------------------------------------------- */}
        <View style={styles.recentHeader}>
          <Text style={styles.eyebrow}>Recent</Text>
          <TouchableOpacity onPress={handleAllNotes} activeOpacity={0.7}>
            <Text style={styles.allNotesLink}>All notes</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recentCards}>
          {notesQuery.isLoading ? (
            <>
              <NoteCardSkeleton />
              <NoteCardSkeleton />
            </>
          ) : recentNotes.length > 0 ? (
            recentNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onPress={() => router.push(`/(tabs)/notes/${note.id}`)}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>
              Share a thought to capture your first note.
            </Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 122,
  },

  // -- Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 36,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 12.5,
    fontWeight: '500',
    color: '#9A9DA1',
  },
  logoutIcon: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutDoor: {
    width: 12,
    height: 16,
    borderWidth: 1.5,
    borderColor: colors.faint,
    borderRadius: 2,
    borderRightWidth: 0,
    position: 'absolute',
    left: 0,
  },
  logoutArrow: {
    width: 10,
    height: 1.5,
    backgroundColor: colors.faint,
    position: 'absolute',
    right: 0,
  },

  // -- Greeting
  greetingBlock: {
    marginBottom: 22,
  },
  greeting: {
    fontFamily: fontFamily.grotesk,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.9,
    lineHeight: 32 * 1.08,
    color: '#18191B',
  },

  // -- Nudge banner
  nudgeBanner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    padding: 15,
    paddingRight: 16,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 22,
  },
  nudgeMark: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#18191B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  nudgeMarkDot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
    backgroundColor: '#2E50E6',
  },
  nudgeTextBlock: {
    flex: 1,
  },
  nudgeContent: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 15 * 1.42,
    color: '#18191B',
  },
  nudgeMeta: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11,
    fontWeight: '600',
    color: '#9A9DA1',
    marginTop: 7,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // -- Capture hero
  heroContainer: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 46,
  },
  heroTouchable: {
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 59,
    borderWidth: 1.5,
    borderColor: 'rgba(46,80,230,0.3)',
  },
  heroCircle: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: '#18191B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.3,
    shadowRadius: 34,
    elevation: 16,
  },
  pencilWrapper: {
    alignItems: 'center',
    transform: [{ rotate: '45deg' }],
  },
  pencilBody: {
    width: 8,
    height: 34,
    borderRadius: 3,
    backgroundColor: '#F3F3F1',
  },
  pencilNib: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#F3F3F1',
    marginTop: -1,
  },
  heroLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 16,
    fontWeight: '600',
    color: '#18191B',
    marginTop: 24,
  },
  heroSub: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '400',
    color: '#9A9DA1',
    marginTop: 5,
  },

  // -- Recent
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  eyebrow: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#9A9DA1',
  },
  allNotesLink: {
    fontFamily: fontFamily.grotesk,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2E50E6',
  },
  recentCards: {
    gap: 10,
  },
  emptyText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '400',
    color: '#9A9DA1',
    textAlign: 'center',
    paddingVertical: 24,
  },
});
