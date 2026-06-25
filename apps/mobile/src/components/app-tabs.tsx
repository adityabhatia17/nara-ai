/**
 * Custom Tab Bar — pixel-matched to Nara.dc.html TAB BAR block.
 *
 * Four tabs: Talk | Notes | Ask | People
 * Frosted bar with rgba(243,243,241,0.85) background, borderTop hairline.
 * Active color: #2E50E6 (accent), inactive: #A8ABAE.
 * Icons drawn with View primitives, labels below.
 *
 * NOTE: The actual tab bar used in production is in (tabs)/_layout.tsx.
 * This file mirrors the same visual for parity.
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, ColorValue } from 'react-native';
import { useRouter, usePathname } from 'expo-router';

// ── Colors ──────────────────────────────────────────────────────────────────

const ACTIVE = '#2E50E6';
const INACTIVE = '#A8ABAE';
const BAR_BG = 'rgba(243,243,241,0.85)';
const BORDER_TOP = 'rgba(20,22,24,0.07)';
const PAPER = '#F3F3F1';

// ── Tab icon components ─────────────────────────────────────────────────────

function TalkIcon({ color }: { color: ColorValue }) {
  return (
    <View style={[talkS.mark, { borderColor: color }]}>
      <View style={[talkS.dot, { backgroundColor: color }]} />
    </View>
  );
}
const talkS = StyleSheet.create({
  mark: { width: 21, height: 21, borderRadius: 6, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 9999 },
});

function NotesIcon({ color }: { color: ColorValue }) {
  return (
    <View style={notesS.container}>
      <View style={[notesS.line, { backgroundColor: color }]} />
      <View style={[notesS.lineShort, { backgroundColor: color }]} />
      <View style={[notesS.line, { backgroundColor: color }]} />
    </View>
  );
}
const notesS = StyleSheet.create({
  container: { width: 21, flexDirection: 'column', gap: 3.5, paddingTop: 1 },
  line: { height: 2.5, borderRadius: 2, width: '100%' },
  lineShort: { height: 2.5, borderRadius: 2, width: '70%' },
});

function AskIcon({ color }: { color: ColorValue }) {
  return <View style={[askS.bubble, { borderColor: color }]} />;
}
const askS = StyleSheet.create({
  bubble: { width: 21, height: 18, borderWidth: 2.5, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomRightRadius: 8, borderBottomLeftRadius: 2 },
});

function PeopleIcon({ color }: { color: ColorValue }) {
  return (
    <View style={peopleS.container}>
      <View style={[peopleS.circle, { borderColor: color }]} />
      <View style={[peopleS.circleOverlap, { borderColor: color }]} />
    </View>
  );
}
const peopleS = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
  circle: { width: 13, height: 13, borderRadius: 9999, borderWidth: 2.5 },
  circleOverlap: { width: 13, height: 13, borderRadius: 9999, borderWidth: 2.5, marginLeft: -6, backgroundColor: PAPER },
});

// ── Tab data ────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'talk', label: 'Talk', route: '/(tabs)/', Icon: TalkIcon },
  { key: 'notes', label: 'Notes', route: '/(tabs)/notes', Icon: NotesIcon },
  { key: 'ask', label: 'Ask', route: '/(tabs)/ask', Icon: AskIcon },
  { key: 'people', label: 'People', route: '/(tabs)/people', Icon: PeopleIcon },
] as const;

// ── Component ───────────────────────────────────────────────────────────────

export default function AppTabs() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const active = pathname === tab.route || pathname.startsWith(tab.route + '/');
        const color = active ? ACTIVE : INACTIVE;
        return (
          <Pressable
            key={tab.key}
            onPress={() => router.push(tab.route as any)}
            style={styles.tab}
          >
            <tab.Icon color={color} />
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BAR_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER_TOP,
    paddingTop: 9,
    paddingHorizontal: 26,
    paddingBottom: 26,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
  },
  tab: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    width: 56,
  },
  label: {
    fontFamily: 'SchibstedGrotesk_600SemiBold',
    fontSize: 10.5,
    fontWeight: '600',
  },
});
