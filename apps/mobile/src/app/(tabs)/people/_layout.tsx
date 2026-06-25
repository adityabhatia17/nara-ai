/**
 * People Stack Layout
 * People list → Person Detail
 * Nested stack under the People tab.
 */

import { Stack } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function PeopleLayout() {
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
