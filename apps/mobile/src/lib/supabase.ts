/**
 * Supabase Client
 * Handles authentication via magic links (OTP email).
 * Platform-aware storage: SecureStore on native, AsyncStorage on web, no-op on SSR.
 */

import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

let SecureStore: any = null;
let AsyncStorage: any = null;

// Only load these on their respective platforms
if (Platform.OS !== 'web') {
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    // Not available
  }
} else if (typeof window !== 'undefined') {
  // Web browser environment
  try {
    AsyncStorage = require('@react-native-async-storage/async-storage').default;
  } catch {
    // Not available
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and/or anon key not configured in .env');
}

// No-op storage for SSR (in-memory only)
const noOpStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

// Platform-aware storage adapter
const createStorage = () => {
  // SSR/Node.js environment
  if (typeof window === 'undefined') {
    return noOpStorage;
  }

  // Native (iOS/Android)
  if (Platform.OS !== 'web' && SecureStore) {
    return {
      async getItem(key: string) {
        return SecureStore.getItemAsync(key);
      },
      async setItem(key: string, value: string) {
        return SecureStore.setItemAsync(key, value);
      },
      async removeItem(key: string) {
        return SecureStore.deleteItemAsync(key);
      },
    };
  }

  // Web browser
  if (AsyncStorage) {
    return {
      getItem: (key: string) => AsyncStorage.getItem(key),
      setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
      removeItem: (key: string) => AsyncStorage.removeItem(key),
    };
  }

  // Fallback (should not reach here)
  return noOpStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorage(),
    autoRefreshToken: true,
    persistSession: true,
  },
});
