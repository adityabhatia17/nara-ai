/**
 * Root Layout — app entry point for Expo Router
 *
 * - Loads all Schibsted Grotesk weights
 * - Holds SplashScreen until fonts are ready
 * - Wraps the tree with SafeAreaProvider + TanStack QueryClientProvider
 * - Defines the root Stack (auth, tabs, full-screen modals)
 * - Guards auth: redirects to /login when there is no active session
 */

import { useEffect } from 'react';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { Redirect, Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_400Regular_Italic,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
} from '@expo-google-fonts/schibsted-grotesk';

import { queryClient } from '@/lib/queryClient';
import { colors } from '@/theme/tokens';
import { useAuthStatus } from '@/hooks/useAuthStatus';
import { useSession } from '@/lib/auth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { supabase } from '@/lib/supabase';

// Keep splash screen up while fonts load
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    // Named weights — used by Text components via fontFamily
    'SchibstedGrotesk-Regular':       SchibstedGrotesk_400Regular,
    'SchibstedGrotesk-RegularItalic': SchibstedGrotesk_400Regular_Italic,
    'SchibstedGrotesk-Medium':        SchibstedGrotesk_500Medium,
    'SchibstedGrotesk-SemiBold':      SchibstedGrotesk_600SemiBold,
    'SchibstedGrotesk-Bold':          SchibstedGrotesk_700Bold,
    // Generic alias used throughout existing components
    SchibstedGrotesk:                 SchibstedGrotesk_400Regular,
    // Explicit weight names used by new components (ErrorBoundary, nudge cards)
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
  });

  const { user, isLoading: authLoading } = useAuthStatus();
  const { session, loading: sessionLoading } = useSession();
  const router = useRouter();

  // Hide splash once fonts have resolved (or failed gracefully)
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Auth gate — push to login when session is known to be absent
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(tabs)');
      }
    }
  }, [user, authLoading, router]);

  // Deep link handler for magic link auth
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      try {
        // Parse the deep link URL (e.g., nara://auth/callback?token_hash=xxx&type=email)
        const parsed = Linking.parse(url);
        const { queryParams } = parsed;

        // Supabase magic link sends token_hash in the URL
        if (queryParams?.token_hash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: queryParams.token_hash as string,
            type: 'email',
          });

          if (error) {
            console.error('Magic link verification failed:', error.message);
          } else if (data.session) {
            // Auth successful — session is set, navigate to home
            console.log('Magic link verified successfully');
            router.replace('/(tabs)');
          }
        }
      } catch (error) {
        console.error('Deep link handling error:', error);
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('Deep link received:', url);
      handleDeepLink(url);
    });

    // Handle if app was launched from a deep link
    Linking.getInitialURL().then((url) => {
      if (url != null) {
        console.log('App launched with deep link:', url);
        handleDeepLink(url);
      }
    });

    return () => subscription.remove();
  }, [router]);

  // Block render until fonts are ready
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            {/* Declarative auth gate — redirect once session state settles */}
            {!sessionLoading && !session && <Redirect href="/(auth)/login" />}

            <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
            }}
          >
            {/* Auth flow — separate from main navigation */}
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />

            {/* Main tab navigation */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

            {/* Full-screen flow screens (no tab bar) */}
            <Stack.Screen
              name="listening"
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="processing"
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name="reveal"
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />

            {/* Rich text editor — full screen modal, no tab bar */}
            <Stack.Screen
              name="editor"
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />

            {/* Nudges — dark overlay modal, Home visible behind */}
            <Stack.Screen
              name="nudges-modal"
              options={{ headerShown: false, presentation: 'transparentModal' }}
            />
            </Stack>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
