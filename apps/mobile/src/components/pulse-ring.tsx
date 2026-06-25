/**
 * PulseRing
 * Standalone component wrapping the usePulseRing animation hook.
 * Renders two cobalt rings rippling outward from the record button.
 *
 * Used by RecordButton — but the hook (usePulseRing) is the canonical
 * animation source; this component is a thin presenter.
 */

import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { colors, radius } from '@/theme/tokens';
import { usePulseRing } from '@/hooks/animations';

const RECORD_BUTTON_SIZE = 118;
const RING_SIZE          = RECORD_BUTTON_SIZE * 1.5; // 177 px
const STROKE_WIDTH       = 1.5;

export function PulseRing() {
  const reduceMotion = useReducedMotion();
  const { ring1Style, ring2Style, active } = usePulseRing(reduceMotion);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      <Animated.View style={[styles.ring, ring1Style]} />
      <Animated.View style={[styles.ring, ring2Style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: radius.circle,
    borderWidth: STROKE_WIDTH,
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
});
