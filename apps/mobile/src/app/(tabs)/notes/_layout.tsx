/**
 * Notes Stack Layout
 * Feed → Note Detail
 * Nested stack under the Notes tab.
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function NotesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.paper,
        },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
