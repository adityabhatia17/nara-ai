/**
 * Auth Stack Layout
 * Handles magic link authentication flow.
 * Separate from main tab navigation.
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
