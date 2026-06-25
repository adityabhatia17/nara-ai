/**
 * Home Screen -- Talk tab
 *
 * Design (from Nara.dc.html lines 29-97):
 *   Header: NaraLogo (25px mark, 7px radius) + "Nara" (18px, 700, -0.4) gap 9px
 *           Right: time (12.5px, 500, #9A9DA1)
 *   Greeting: 32px, 700, tracking -0.9, ink, margin-bottom 22px
 *   Record button area: centered, padding 52px top 46px bottom
 *     Button: 118px circle, ink bg, shadow
 *     "Hold to talk." -- 16px, 600, ink, margin-top 24px
 *     Subtitle: "Talk for 30 seconds or 10 minutes..." -- 13px, 400, #9A9DA1, margin-top 5px
 *   "Recent" header: flex between, eyebrow left, "All notes" 12.5px 600 cobalt right
 *   Note cards: gap 10px
 */

import { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Animated from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';

import { colors, spacing, fontFamily } from '@/theme/tokens';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { NaraLogo } from '@/components/nara-logo';
import { NoteCard } from '@/components/note-card';
import { NoteCardSkeleton } from '@/components/NoteCardSkeleton';
import { usePushDown } from '@/hooks/animations';
import type { MeResponse, NotesListResponse, NudgesListResponse, CreateEntryRequest, CreateEntryResponse } from '@nara/shared';

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

// -- Screen ------------------------------------------------------------------

const TAB_BAR_HEIGHT = 80;

export default function HomeScreen() {
  const router = useRouter();
  const now = new Date();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [quickInput, setQuickInput] = useState('');

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

  // -- Quick entry mutation
  const entryMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.post<CreateEntryResponse>('/entries', {
        text,
      } as CreateEntryRequest);
      return res.data;
    },
    onSuccess: () => {
      setQuickInput('');
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });

  // -- Derived state
  const displayName = meQuery.data?.display_name ?? null;
  const greeting = `${getGreeting(now)}, ${displayName ?? 'there'}.`;
  const timeLabel = formatHeaderTime(now);
  const recentNotes = notesQuery.data?.notes ?? [];
  const latestNudge = nudgesQuery.data?.nudges?.[0] ?? null;
  const bottomPadding = TAB_BAR_HEIGHT + insets.bottom;

  const handleQuickSend = useCallback(() => {
    const text = quickInput.trim();
    if (!text || entryMutation.isPending) return;
    entryMutation.mutate(text);
  }, [quickInput, entryMutation]);

  const handleCreateNew = useCallback(() => {
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
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
                <NoteCard key={note.id} note={note} />
              ))
            ) : (
              <Text style={styles.emptyText}>
                Share a thought to capture your first note.
              </Text>
            )}
          </View>

        </ScrollView>

        {/* -- Bottom area (fixed, above tab bar) ----------------------------- */}
        <View style={[styles.bottomArea, { paddingBottom: bottomPadding }]}>
          {/* Quick input row */}
          <View style={styles.quickInputRow}>
            <View style={styles.quickInputBar}>
              <TextInput
                style={styles.quickInput}
                placeholder="What's on your mind?"
                placeholderTextColor="#9A9DA1"
                value={quickInput}
                onChangeText={setQuickInput}
                multiline
                maxLength={2000}
                editable={!entryMutation.isPending}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={handleQuickSend}
              />
            </View>
            {quickInput.trim().length > 0 && (
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleQuickSend}
                disabled={entryMutation.isPending}
                activeOpacity={0.8}
              >
                <Text style={styles.sendIcon}>↑</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Create New button */}
          <TouchableOpacity
            style={styles.createNewButton}
            onPress={handleCreateNew}
            activeOpacity={0.85}
          >
            <Text style={styles.createNewPlus}>+</Text>
            <Text style={styles.createNewText}>Create a new note</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 16,
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

  // -- Bottom area (fixed above tab bar)
  bottomArea: {
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: 'rgba(20,22,24,0.05)',
  },
  quickInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickInputBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.12)',
    borderRadius: 999,
  },
  quickInput: {
    flex: 1,
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '400',
    color: '#18191B',
    paddingVertical: 0,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: '#2E50E6',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendIcon: {
    fontFamily: fontFamily.grotesk,
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 18,
    marginTop: -1,
  },
  createNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18191B',
    borderRadius: 14,
    height: 48,
    marginTop: 10,
    gap: 6,
  },
  createNewPlus: {
    fontFamily: fontFamily.grotesk,
    fontSize: 18,
    fontWeight: '500',
    color: colors.paper,
    marginTop: -1,
  },
  createNewText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '600',
    color: colors.paper,
  },
});
