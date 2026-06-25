/**
 * Auth utilities for Nara.
 * Wraps Supabase auth with a clean hook + sign-out helper.
 */

import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// useSession
// ---------------------------------------------------------------------------

/**
 * Subscribes to the Supabase auth state and exposes the current session.
 * Use this in the root layout to drive the auth gate.
 *
 * - `loading` is true only until the initial session check resolves.
 * - `session` is null when the user is not signed in.
 */
export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the current session immediately
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    // Keep in sync with auth state changes (sign-in / sign-out / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession ?? null);
        // After the initial load, loading stays false
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}

// ---------------------------------------------------------------------------
// signOut
// ---------------------------------------------------------------------------

/**
 * Signs the user out of Supabase, clears local secure storage (handled by the
 * Supabase client's custom storage adapter), and navigates to the login screen.
 */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  // The onAuthStateChange listener in useSession will set session to null.
  // Navigate to login immediately so the user doesn't see a flash of the app.
  router.replace('/(auth)/login');
}
