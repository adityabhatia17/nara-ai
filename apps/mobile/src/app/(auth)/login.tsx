/**
 * Login Screen
 *
 * Centered layout on paper (#F3F3F1):
 *   NaraLogo (58px mark) + "Nara" wordmark (32px, 700, tracking -0.9)
 *   Tagline: "Just talk. Nara remembers." (15.5px italic 400, subInk)
 *   Email input — 48px height, paper bg, ink border (hairline), radius 999 pill
 *   "Send magic link" — PrimaryButton (ink bg, paper text, full width)
 *
 * States:
 *   idle     → show form
 *   loading  → button shows spinner label
 *   success  → "Check your email" confirmation (no Alert)
 *   error    → inline error text below input (no Alert)
 *
 * No password. No OAuth. Magic link only.
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
import { colors, spacing, radius, fontFamily } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { NaraLogo } from '@/components/nara-logo';
import type { MagicLinkRequest } from '@nara/shared';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<'magic' | 'password'>('magic');

  const sendMagicLink = useMutation({
    mutationFn: async (emailAddr: string) => {
      const response = await fetch('http://192.168.1.7:3000/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr }),
      });
      if (!response.ok) throw new Error('Failed to send magic link');
      return response.json();
    },
    onSuccess: () => {
      setErrorMsg(null);
    },
    onError: (err: any) => {
      const msg = err?.message || 'Something went wrong. Please try again.';
      setErrorMsg(msg);
    },
  });

  const passwordLogin = useMutation({
    mutationFn: async (creds: { email: string; password: string }) => {
      const { data, error } = await supabase.auth.signInWithPassword(creds);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setErrorMsg(null);
    },
    onError: (err: any) => {
      setErrorMsg(err?.message || 'Login failed. Please try again.');
    },
  });

  const handleMagicLink = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setErrorMsg(null);
    sendMagicLink.mutate(trimmed);
  };

  const handlePassword = () => {
    const trimmed = email.trim();
    if (!trimmed || !password) {
      setErrorMsg('Please enter email and password.');
      return;
    }
    setErrorMsg(null);
    passwordLogin.mutate({ email: trimmed, password });
  };

  const isMagicSuccess = sendMagicLink.isSuccess;
  const isMagicPending = sendMagicLink.isPending;
  const isPasswordPending = passwordLogin.isPending;

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
          {/* ── Identity block ───────────────────────────────────── */}
          <View style={styles.identity}>
            <NaraLogo size="large" showWordmark={false} />
            <Text style={styles.wordmark}>Nara</Text>
            <Text style={styles.tagline}>Just talk. Nara remembers.</Text>
          </View>

          {/* ── Mode toggle ───────────────────────────────────── */}
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'magic' && styles.modeBtnActive]}
              onPress={() => {
                setMode('magic');
                setErrorMsg(null);
                setPassword('');
              }}
            >
              <Text style={[styles.modeText, mode === 'magic' && styles.modeTextActive]}>Magic Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, mode === 'password' && styles.modeBtnActive]}
              onPress={() => {
                setMode('password');
                setErrorMsg(null);
              }}
            >
              <Text style={[styles.modeText, mode === 'password' && styles.modeTextActive]}>Password</Text>
            </TouchableOpacity>
          </View>

          {/* ── Form / Success ───────────────────────────────────── */}
          {isMagicSuccess && mode === 'magic' ? (
            <View style={styles.successBlock}>
              <Text style={styles.successTitle}>Check your email</Text>
              <Text style={styles.successBody}>
                We sent a magic link to{' '}
                <Text style={styles.successEmail}>{email.trim()}</Text>.
              </Text>
              <TouchableOpacity
                style={styles.retryLink}
                onPress={() => {
                  sendMagicLink.reset();
                  setEmail('');
                }}
              >
                <Text style={styles.retryText}>Try another email</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              {/* Email input */}
              <TextInput
                style={[styles.input, errorMsg ? styles.inputError : null]}
                placeholder="your@email.com"
                placeholderTextColor={colors.faint}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errorMsg) setErrorMsg(null);
                }}
                editable={!isMagicPending && !isPasswordPending}
              />

              {/* Password input (password mode only) */}
              {mode === 'password' && (
                <TextInput
                  style={[styles.input, errorMsg ? styles.inputError : null]}
                  placeholder="Password"
                  placeholderTextColor={colors.faint}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="password"
                  autoCorrect={false}
                  value={password}
                  onChangeText={(v) => {
                    setPassword(v);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  editable={!isPasswordPending}
                />
              )}

              {/* Inline error */}
              {errorMsg ? (
                <Text style={styles.errorText}>{errorMsg}</Text>
              ) : null}

              {/* CTA */}
              <TouchableOpacity
                style={[
                  styles.cta,
                  (isMagicPending || isPasswordPending) && styles.ctaDisabled,
                ]}
                onPress={mode === 'magic' ? handleMagicLink : handlePassword}
                disabled={isMagicPending || isPasswordPending}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaLabel}>
                  {isMagicPending && 'Sending…'}
                  {isPasswordPending && 'Signing in…'}
                  {!isMagicPending && !isPasswordPending && (mode === 'magic' ? 'Send magic link' : 'Sign in')}
                </Text>
              </TouchableOpacity>

              {/* Test credentials hint */}
              {mode === 'password' && (
                <Text style={styles.hintText}>
                  Test: test@nara.dev / TestPassword123!
                </Text>
              )}
            </View>
          )}
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
  hintText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11,
    color: colors.faint,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // ── Success
  successBlock: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.lg,
  },
  successTitle: {
    fontFamily: fontFamily.grotesk,
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.ink,
    textAlign: 'center',
  },
  successBody: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '400',
    color: colors.subInk,
    textAlign: 'center',
    lineHeight: 22,
  },
  successEmail: {
    fontWeight: '600',
    color: colors.ink,
  },
  retryLink: {
    paddingVertical: spacing.sm,
  },
  retryText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
  },
});
