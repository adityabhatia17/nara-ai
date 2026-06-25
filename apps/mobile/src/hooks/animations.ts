/**
 * Nara Animation Hooks
 * Centralised Reanimated hooks for all 6 spec animations.
 * All animations are disabled when reduceMotion=true.
 *
 * Spec source: docs/CLAUDE_FRONTEND.md § 5 "The 6 animations"
 */

import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

// ─── wavePulse ──────────────────────────────────────────────────────────────
// 38 cobalt bars, scaleY 0.30→1, ease-in-out infinite.
// Duration: 0.8–1.4s per bar. Delay: 0–0.56s staggered.
// Disabled: static at scaleY 0.5.

export function useWavePulse(barIndex: number, reduceMotion: boolean) {
  const progress = useSharedValue(reduceMotion ? 0.5 : 0);

  const delay = (barIndex / 37) * 560; // 0–560 ms
  const duration = 800 + (barIndex / 37) * 600; // 800–1400 ms

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5; // static mid-point
      return;
    }

    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useAnimatedStyle(() => {
    const scaleY = reduceMotion
      ? 0.5
      : interpolate(progress.value, [0, 1], [0.3, 1], Extrapolation.CLAMP);
    return { transform: [{ scaleY }] };
  });
}

// ─── breathe ────────────────────────────────────────────────────────────────
// scale 1→1.06, 1.6s ease-in-out infinite.
// Disabled: static at scale 1.

export function useBreathe(reduceMotion: boolean) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useAnimatedStyle(() => {
    const scale = reduceMotion
      ? 1
      : interpolate(progress.value, [0, 1], [1, 1.06], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });
}

// ─── fadeUp ─────────────────────────────────────────────────────────────────
// translateY 16→0 + opacity 0→1, 0.5s ease.
// Stagger: index * 130 ms.
// Disabled: immediately visible, no translation.

export function useFadeUp(index: number, reduceMotion: boolean, delayMs?: number) {
  const translateY = useSharedValue(reduceMotion ? 0 : 16);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  const staggerDelay = delayMs ?? index * 130; // custom or 0, 130, 260, 390 …

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
      return;
    }

    const easing = Easing.out(Easing.ease);
    translateY.value = withDelay(
      staggerDelay,
      withTiming(0, { duration: 500, easing })
    );
    opacity.value = withDelay(
      staggerDelay,
      withTiming(1, { duration: 500, easing })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

// ─── dotBlink ────────────────────────────────────────────────────────────────
// opacity 0.25→1, 1.2s infinite.
// Each dot is delayed by dotIndex * 200 ms.
// Disabled: static at opacity 1.

export function useDotBlink(dotIndex: number, reduceMotion: boolean) {
  const opacity = useSharedValue(reduceMotion ? 1 : 0.25);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return;
    }

    opacity.value = withDelay(
      dotIndex * 200,
      withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
}

// ─── pulseRing ───────────────────────────────────────────────────────────────
// Two cobalt rings ripple outward from the record button.
// Scale: 0.92 → 1.5, opacity: 0.5 → 0, 3 s ease-out infinite.
// Ring 2 starts 1.5 s after ring 1 (staggered).
// Disabled: rings hidden (opacity 0).

const PULSE_DURATION = 3000;
const RING_OFFSET    = 1500;

export function usePulseRing(reduceMotion: boolean) {
  const progress1 = useSharedValue(0);
  const progress2 = useSharedValue(0);

  useEffect(() => {
    if (!reduceMotion) {
      progress1.value = withRepeat(
        withTiming(1, { duration: PULSE_DURATION, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      progress2.value = withDelay(
        RING_OFFSET,
        withRepeat(
          withTiming(1, { duration: PULSE_DURATION, easing: Easing.out(Easing.ease) }),
          -1,
          false
        )
      );
    } else {
      progress1.value = 0;
      progress2.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress1.value,
          [0, 1],
          [0.92, 1.5],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: interpolate(progress1.value, [0, 1], [0.5, 0], Extrapolation.CLAMP),
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          progress2.value,
          [0, 1],
          [0.92, 1.5],
          Extrapolation.CLAMP
        ),
      },
    ],
    opacity: interpolate(progress2.value, [0, 1], [0.5, 0], Extrapolation.CLAMP),
  }));

  return { ring1Style, ring2Style, active: !reduceMotion };
}

// ─── pushDown ────────────────────────────────────────────────────────────────
// translateY -14→0 + opacity 0→1, 0.5s ease.
// Disabled: immediately visible.

export function usePushDown(reduceMotion: boolean) {
  const translateY = useSharedValue(reduceMotion ? 0 : -14);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      translateY.value = 0;
      opacity.value = 1;
      return;
    }

    const easing = Easing.out(Easing.ease);
    translateY.value = withTiming(0, { duration: 500, easing });
    opacity.value = withTiming(1, { duration: 500, easing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
