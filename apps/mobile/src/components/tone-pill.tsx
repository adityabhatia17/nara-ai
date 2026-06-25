/**
 * TonePill Component
 * Used in Person Detail timeline to show emotional tone of a note.
 * Colored by tone: positive → green, neutral → gray, negative → red.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { radius, fontFamily } from '@/theme/tokens';
import { Tone } from '@nara/shared';

export interface TonePillProps {
  tone: Tone;
}

const TONE_COLORS: Record<Tone, { bg: string; text: string; label: string }> = {
  positive: {
    bg: '#D7F0E7',
    text: '#1B9C77',
    label: 'Positive',
  },
  neutral: {
    bg: '#E9E9E9',
    text: '#5A5A5A',
    label: 'Neutral',
  },
  negative: {
    bg: '#F8E2E8',
    text: '#D24E6E',
    label: 'Challenging',
  },
};

export function TonePill({ tone }: TonePillProps) {
  const toneInfo = TONE_COLORS[tone];

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: toneInfo.bg },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: toneInfo.text },
        ]}
      >
        {toneInfo.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11,
    fontWeight: '600',
  },
});
