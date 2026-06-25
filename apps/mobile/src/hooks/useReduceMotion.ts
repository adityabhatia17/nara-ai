/**
 * useReduceMotion — thin re-export wrapping Reanimated v4's useReducedMotion().
 *
 * react-native-reanimated v4 exposes `useReducedMotion(): boolean` which reads
 * the native "Reduce Motion" accessibility setting directly. This hook wraps it
 * for backward-compat with code that imports from here.
 *
 * Usage:
 *   const { reduceMotion } = useReduceMotion();
 * Or import directly:
 *   import { useReducedMotion } from 'react-native-reanimated';
 */

import { useReducedMotion } from 'react-native-reanimated';

export function useReduceMotion() {
  const reduceMotion = useReducedMotion();
  return { reduceMotion };
}
