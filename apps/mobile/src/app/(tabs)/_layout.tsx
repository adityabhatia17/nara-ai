/**
 * Tab Navigator Layout
 * Defines the four main navigation tabs: Talk | Notes | Ask | People
 *
 * Tab bar icons are custom-drawn using View components to match the design
 * prototype exactly:
 *   Talk:   21px square mark (6px radius, 2.5px border) with 7px cobalt dot
 *   Notes:  3 horizontal lines (21px wide, 2.5px height, 3.5px gap, second 70%)
 *   Ask:    Chat bubble (21x18, 2.5px border, radius 8/8/8/2)
 *   People: Two overlapping circles (13px, 2.5px border, second offset -6px)
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, ColorValue } from 'react-native';
import { colors, fontFamily } from '@/theme/tokens';

// ── Custom tab bar icon components ──────────────────────────────────────────

function TalkIcon({ color }: { color: ColorValue }) {
  return (
    <View style={[talkStyles.mark, { borderColor: color }]}>
      <View style={[talkStyles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const talkStyles = StyleSheet.create({
  mark: {
    width: 21,
    height: 21,
    borderRadius: 6,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 9999,
  },
});

function NotesIcon({ color }: { color: ColorValue }) {
  return (
    <View style={notesStyles.container}>
      <View style={[notesStyles.line, { backgroundColor: color }]} />
      <View style={[notesStyles.lineShort, { backgroundColor: color }]} />
      <View style={[notesStyles.line, { backgroundColor: color }]} />
    </View>
  );
}

const notesStyles = StyleSheet.create({
  container: {
    width: 21,
    flexDirection: 'column',
    gap: 3.5,
    paddingTop: 1,
  },
  line: {
    height: 2.5,
    borderRadius: 2,
    width: '100%',
  },
  lineShort: {
    height: 2.5,
    borderRadius: 2,
    width: '70%',
  },
});

function AskIcon({ color }: { color: ColorValue }) {
  return (
    <View
      style={[
        askStyles.bubble,
        { borderColor: color },
      ]}
    />
  );
}

const askStyles = StyleSheet.create({
  bubble: {
    width: 21,
    height: 18,
    borderWidth: 2.5,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    borderBottomLeftRadius: 2,
  },
});

function PeopleIcon({ color }: { color: ColorValue }) {
  return (
    <View style={peopleStyles.container}>
      <View style={[peopleStyles.circle, { borderColor: color }]} />
      <View
        style={[
          peopleStyles.circleOverlap,
          { borderColor: color, backgroundColor: '#F3F3F1' },
        ]}
      />
    </View>
  );
}

const peopleStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  circle: {
    width: 13,
    height: 13,
    borderRadius: 9999,
    borderWidth: 2.5,
  },
  circleOverlap: {
    width: 13,
    height: 13,
    borderRadius: 9999,
    borderWidth: 2.5,
    marginLeft: -6,
  },
});

// ── Tab layout ──────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: '#A8ABAE',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      {/* Talk tab -- Home screen */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Talk',
          tabBarLabel: 'Talk',
          tabBarIcon: ({ color }) => <TalkIcon color={color} />,
        }}
      />

      {/* Notes tab -- Feed with stack navigation */}
      <Tabs.Screen
        name="notes"
        options={{
          title: 'Notes',
          tabBarLabel: 'Notes',
          tabBarIcon: ({ color }) => <NotesIcon color={color} />,
        }}
      />

      {/* Ask tab -- Ask Nara chat */}
      <Tabs.Screen
        name="ask"
        options={{
          title: 'Ask',
          tabBarLabel: 'Ask',
          tabBarIcon: ({ color }) => <AskIcon color={color} />,
        }}
      />

      {/* People tab -- People list with stack navigation */}
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarLabel: 'People',
          tabBarIcon: ({ color }) => <PeopleIcon color={color} />,
        }}
      />

      {/* Settings tab -- Hidden from tab bar, accessed via menu */}
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(243,243,241,0.85)',
    borderTopColor: 'rgba(20,22,24,0.07)',
    borderTopWidth: 1,
    paddingTop: 9,
    paddingBottom: 26,
    paddingHorizontal: 26,
    height: 'auto' as any,
  },
  tabBarLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 10.5,
    fontWeight: '600',
  },
  tabBarItem: {
    gap: 5,
    width: 56,
  },
});
