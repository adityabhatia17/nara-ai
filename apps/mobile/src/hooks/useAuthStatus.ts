/**
 * Auth Status Hook
 * Checks if user is authenticated and manages auth state.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export interface AuthUser {
  id: string;
  email: string;
}

export function useAuthStatus() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const checkAuth = async () => {
      try {
        // Check if user is already logged in
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
          });
        }

        // Subscribe to auth state changes
        const { data } = supabase.auth.onAuthStateChange((event, session) => {
          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email || '',
            });
          } else {
            setUser(null);
          }
        });

        unsubscribe = data.subscription.unsubscribe;
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    return () => {
      unsubscribe?.();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return { user, isLoading, logout };
}
