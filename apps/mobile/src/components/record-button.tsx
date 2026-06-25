/**
 * Record Button
 *
 * Design (from Nara.dc.html lines 54-68):
 *   Container: 128px total with pulse rings at inset 4px
 *   Button: 118px ink circle, shadow 0 16px 34px rgba(24,25,27,0.3)
 *   Mic icon: custom drawn white shapes:
 *     - Capsule: 21x31px, 11px radius, paper color
 *     - Arc: 27x13px bottom half, 2.5px border paper, radius 0 0 14px 14px, margin-top -6px
 *     - Stem: 2.5x6px, paper color
 *     - Base: 15x2.5px, 2px radius, paper color, margin-top 1px
 *   Pulse rings: 1.5px border rgba(46,80,230,0.3), absolute inset 4px
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, shadow } from '@/theme/tokens';
import { usePulseRing } from '@/hooks/animations';

interface RecordButtonProps {
  onPress: () => void;
}

const BUTTON_SIZE = 118;
const CONTAINER_SIZE = 128;

export function RecordButton({ onPress }: RecordButtonProps) {
  const reduceMotion = useReducedMotion();
  const { ring1Style, ring2Style, active } = usePulseRing(reduceMotion);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={16}
      style={({ pressed }) => [
        styles.pressable,
        pressed && styles.pressableActive,
      ]}
    >
      {/* Pulse rings -- rendered behind the button */}
      {active && (
        <View style={styles.ringsContainer} pointerEvents="none">
          <Animated.View style={[styles.ring, ring1Style]} />
          <Animated.View style={[styles.ring, ring2Style]} />
        </View>
      )}

      {/* The ink circle */}
      <View style={styles.circle}>
        {/* Custom mic icon -- drawn with View components */}
        <View style={styles.micContainer}>
          {/* Capsule (mic head) */}
          <View style={styles.micCapsule} />
          {/* Arc (cradle) */}
          <View style={styles.micArc} />
          {/* Stem */}
          <View style={styles.micStem} />
          {/* Base */}
          <View style={styles.micBase} />
        </View>
      </View>
    </Pressable>
  );
}

const MIC_COLOR = '#F3F3F1';

const styles = StyleSheet.create({
  pressable: {
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressableActive: {
    opacity: 0.85,
  },
  ringsContainer: {
    position: 'absolute',
    width: CONTAINER_SIZE,
    height: CONTAINER_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    // inset 4px from container = 120px
    width: CONTAINER_SIZE - 8,
    height: CONTAINER_SIZE - 8,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: 'rgba(46,80,230,0.3)',
    backgroundColor: 'transparent',
  },
  circle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 9999,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.recordBtn,
  },

  // -- Custom mic icon shapes ------------------------------------------------
  micContainer: {
    alignItems: 'center',
  },
  micCapsule: {
    width: 21,
    height: 31,
    borderRadius: 11,
    backgroundColor: MIC_COLOR,
  },
  micArc: {
    width: 27,
    height: 13,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderColor: MIC_COLOR,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginTop: -6,
  },
  micStem: {
    width: 2.5,
    height: 6,
    backgroundColor: MIC_COLOR,
  },
  micBase: {
    width: 15,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: MIC_COLOR,
    marginTop: 1,
  },
});
