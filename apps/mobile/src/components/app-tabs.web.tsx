/**
 * Custom Tab Bar (Web) — pixel-matched to Nara.dc.html TAB BAR block.
 *
 * Four tabs: Talk | Notes | Ask | People
 * Frosted bar with rgba(243,243,241,0.85) background + backdrop-filter blur,
 * borderTop hairline.
 * Active color: #2E50E6 (accent), inactive: #A8ABAE.
 * Icons drawn with View primitives, labels below.
 */

import React from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
} from 'expo-router/ui';
import { Pressable, View, Text, StyleSheet } from 'react-native';

// ── Colors ──────────────────────────────────────────────────────────────────

const ACTIVE = '#2E50E6';
const INACTIVE = '#A8ABAE';
const BAR_BG = 'rgba(243,243,241,0.85)';
const BORDER_TOP = 'rgba(20,22,24,0.07)';
const PAPER = '#F3F3F1';

// ── Tab icon components ─────────────────────────────────────────────────────

function TalkIcon({ color }: { color: string }) {
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

function NotesIcon({ color }: { color: string }) {
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

function AskIcon({ color }: { color: string }) {
  return <View style={[askS.bubble, { borderColor: color }]} />;
}
const askS = StyleSheet.create({
  bubble: { width: 21, height: 18, borderWidth: 2.5, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomRightRadius: 8, borderBottomLeftRadius: 2 },
});

function PeopleIcon({ color }: { color: string }) {
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

// ── Tab button ──────────────────────────────────────────────────────────────

interface TabConfig {
  icon: (props: { color: string }) => React.JSX.Element;
  label: string;
}

const TAB_CONFIG: Record<string, TabConfig> = {
  home: { icon: TalkIcon, label: 'Talk' },
  notes: { icon: NotesIcon, label: 'Notes' },
  ask: { icon: AskIcon, label: 'Ask' },
  people: { icon: PeopleIcon, label: 'People' },
};

function TabButton({ children, isFocused, name, ...props }: TabTriggerSlotProps & { name: string }) {
  const config = TAB_CONFIG[name];
  const color = isFocused ? ACTIVE : INACTIVE;
  const Icon = config?.icon;

  return (
    <Pressable {...props} style={styles.tab}>
      {Icon && <Icon color={color} />}
      <Text style={[styles.label, { color }]}>
        {config?.label ?? children}
      </Text>
    </Pressable>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={styles.bar}>
        <TabTrigger name="home" href="/" asChild>
          <TabButton name="home">Talk</TabButton>
        </TabTrigger>
        <TabTrigger name="notes" href="/notes" asChild>
          <TabButton name="notes">Notes</TabButton>
        </TabTrigger>
        <TabTrigger name="ask" href="/ask" asChild>
          <TabButton name="ask">Ask</TabButton>
        </TabTrigger>
        <TabTrigger name="people" href="/people" asChild>
          <TabButton name="people">People</TabButton>
        </TabTrigger>
      </TabList>
    </Tabs>
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
