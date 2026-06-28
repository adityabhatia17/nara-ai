/**
 * Login Screen
 *
 * Centered layout on paper (#F3F3F1):
 *   NaraLogo (58px mark) + "Nara" wordmark (32px, 700, tracking -0.9)
 *   Tagline: "Just talk. Nara remembers." (15.5px italic 400, subInk)
 *   Sign in / Sign up toggle (pill buttons)
 *   Email + Password inputs (+ Name on sign-up)
 *   Primary CTA
 *   Divider ("or")
 *   Continue with Google (OAuth via expo-web-browser)
 *
 * Auth is client-side via the Supabase SDK. The useSession hook
 * in auth.ts reacts to onAuthStateChange, so successful auth
 * automatically routes into the app.
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors, spacing, radius, fontFamily } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { NaraLogo } from '@/components/nara-logo';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Sign up ──────────────────────────────────────────────────
  const signUp = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: name.trim() ? { display_name: name.trim() } : undefined },
      });
      if (error) throw error;
    },
    onError: (e: any) => setErrorMsg(e?.message ?? 'Sign up failed'),
  });

  // ── Sign in ──────────────────────────────────────────────────
  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    },
    onError: (e: any) => setErrorMsg(e?.message ?? 'Login failed'),
  });

  // ── Google OAuth ─────────────────────────────────────────────
  const googleSignIn = useMutation({
    mutationFn: async () => {
      const redirectTo = Linking.createURL('/');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) throw error;
      if (!data?.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    },
    onError: (e: any) => setErrorMsg(e?.message ?? 'Google sign-in failed'),
  });

  // ── Validation + submit ──────────────────────────────────────
  const handleSubmit = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter a password.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg(null);
    if (mode === 'signup') {
      signUp.mutate();
    } else {
      signIn.mutate();
    }
  };

  const isPending = signIn.isPending || signUp.isPending || googleSignIn.isPending;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Identity block ──────────────────────────────────── */}
          <View style={styles.identity}>
            <NaraLogo size="large" showWordmark={false} />
            <Text style={styles.wordmark}>Nara</Text>
            <Text style={styles.tagline}>Just talk. Nara remembers.</Text>
          </View>

          {/* ── Mode toggle ─────────────────────────────────────── */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'signin' && styles.modeBtnActive]}
              onPress={() => { setMode('signin'); setErrorMsg(null); }}
            >
              <Text style={[styles.modeText, mode === 'signin' && styles.modeTextActive]}>
                Sign in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'signup' && styles.modeBtnActive]}
              onPress={() => { setMode('signup'); setErrorMsg(null); }}
            >
              <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>
                Sign up
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Form ────────────────────────────────────────────── */}
          <View style={styles.form}>
            {/* Name (sign-up only) */}
            {mode === 'signup' && (
              <TextInput
                style={styles.input}
                placeholder="Name (optional)"
                placeholderTextColor={colors.faint}
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect={false}
                value={name}
                onChangeText={(v) => { setName(v); if (errorMsg) setErrorMsg(null); }}
                editable={!isPending}
              />
            )}

            {/* Email */}
            <TextInput
              style={[styles.input, errorMsg ? styles.inputError : null]}
              placeholder="your@email.com"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              value={email}
              onChangeText={(v) => { setEmail(v); if (errorMsg) setErrorMsg(null); }}
              editable={!isPending}
            />

            {/* Password */}
            <TextInput
              style={[styles.input, errorMsg ? styles.inputError : null]}
              placeholder="Password"
              placeholderTextColor={colors.faint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              autoCorrect={false}
              value={password}
              onChangeText={(v) => { setPassword(v); if (errorMsg) setErrorMsg(null); }}
              editable={!isPending}
            />

            {/* Inline error */}
            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Primary CTA */}
            <TouchableOpacity
              style={[styles.cta, isPending && styles.ctaDisabled]}
              onPress={handleSubmit}
              disabled={isPending}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaLabel}>
                {signIn.isPending && 'Signing in...'}
                {signUp.isPending && 'Creating account...'}
                {!signIn.isPending && !signUp.isPending && (
                  mode === 'signin' ? 'Sign in' : 'Create account'
                )}
              </Text>
            </TouchableOpacity>

            {/* ── Divider ─────────────────────────────────────────── */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* ── Google OAuth ────────────────────────────────────── */}
            <TouchableOpacity
              style={[styles.googleBtn, googleSignIn.isPending && styles.ctaDisabled]}
              onPress={() => { setErrorMsg(null); googleSignIn.mutate(); }}
              disabled={isPending}
              activeOpacity={0.85}
            >
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.googleLabel}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    gap: spacing.xxl,
  },

  // ── Identity
  identity: {
    alignItems: 'center',
    gap: spacing.md,
  },
  wordmark: {
    fontFamily: fontFamily.grotesk,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.9,
    color: colors.ink,
    marginTop: spacing.sm,
  },
  tagline: {
    fontFamily: 'SchibstedGrotesk-RegularItalic',
    fontSize: 15.5,
    fontWeight: '400',
    color: colors.subInk,
    textAlign: 'center',
  },

  // ── Mode toggle
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.interactive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  modeText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '600',
    color: colors.subInk,
  },
  modeTextActive: {
    color: colors.paper,
  },

  // ── Form
  form: {
    width: '100%',
    gap: spacing.sm,
  },
  input: {
    height: 48,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.interactive,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    fontFamily: fontFamily.grotesk,
    color: colors.ink,
  },
  inputError: {
    borderColor: '#D24E6E',
  },
  errorText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    color: '#D24E6E',
    paddingHorizontal: spacing.xs,
  },
  cta: {
    height: 48,
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '600',
    color: colors.paper,
  },

  // ── Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.interactive,
  },
  dividerText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    color: colors.faint,
  },

  // ── Google button
  googleBtn: {
    height: 48,
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.interactive,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  googleG: {
    fontFamily: fontFamily.grotesk,
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
});
