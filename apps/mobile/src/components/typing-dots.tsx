/**
 * TypingDots Component (dotBlink animation)
 * Three cobalt dots with staggered opacity animation.
 * Uses the canonical useDotBlink hook from hooks/animations.ts.
 * Disabled when reduce-motion is active.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { colors, spacing } from '@/theme/tokens';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useDotBlink } from '@/hooks/animations';

function AnimatedDot({ index, reduceMotion }: { index: number; reduceMotion: boolean }) {
  const animStyle = useDotBlink(index, reduceMotion);
  return <Animated.View style={[styles.dot, animStyle]} />;
}

export function TypingDots() {
  const { reduceMotion } = useReduceMotion();

  return (
    <View style={styles.container}>
      <AnimatedDot index={0} reduceMotion={reduceMotion} />
      <AnimatedDot index={1} reduceMotion={reduceMotion} />
      <AnimatedDot index={2} reduceMotion={reduceMotion} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.accent,
  },
});
