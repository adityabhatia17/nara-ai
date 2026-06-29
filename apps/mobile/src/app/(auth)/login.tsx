/**
 * Login Screen -- Email / Password (Sign in + Sign up toggle)
 *
 * Sign in:  supabase.auth.signInWithPassword({ email, password }).
 * Sign up:  supabase.auth.signUp({ email, password, options }).
 *           If Supabase "Confirm email" is enabled, data.session will be null
 *           and we show a "Check your email" confirmation state.
 *
 * Centered layout on paper (#F3F3F1), matching existing design language.
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

type Mode = 'signin' | 'signup';

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resentMsg, setResentMsg] = useState<string | null>(null);

  // -- Sign In ----------------------------------------------------------------
  const signIn = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      // Session is now set; onAuthStateChange in useSession handles routing.
    },
    onError: (e: any) => {
      const msg: string = e?.message ?? 'Sign in failed';
      if (/not confirmed/i.test(msg)) {
        setErrorMsg(
          'Please confirm your email first. Check your inbox for the confirmation link.',
        );
      } else {
        setErrorMsg(msg);
      }
    },
  });

  // -- Sign Up ----------------------------------------------------------------
  const signUp = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: name.trim() ? { display_name: name.trim() } : undefined },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      // No session means email confirmation is required
      if (!data.session) {
        setAwaitingConfirm(true);
      }
      // If data.session exists, useSession's onAuthStateChange handles routing.
    },
    onError: (e: any) => setErrorMsg(e?.message ?? 'Sign up failed'),
  });

  // -- Resend confirmation email ----------------------------------------------
  const resendConfirmation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => setResentMsg('Sent! Check your inbox.'),
    onError: (e: any) => setResentMsg(e?.message ?? 'Could not resend'),
  });

  // -- Validation + submit ----------------------------------------------------
  const handleSubmit = () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }
    setErrorMsg(null);
    if (mode === 'signin') {
      signIn.mutate();
    } else {
      signUp.mutate();
    }
  };

  const handleToggleMode = () => {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'));
    setErrorMsg(null);
    setAwaitingConfirm(false);
    setResentMsg(null);
  };

  const handleBackToSignIn = () => {
    setAwaitingConfirm(false);
    setResentMsg(null);
    setMode('signin');
    setPassword('');
    setErrorMsg(null);
  };

  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (errorMsg) setErrorMsg(null);
    if (awaitingConfirm) {
      setAwaitingConfirm(false);
      setResentMsg(null);
    }
  };

  const isPending = signIn.isPending || signUp.isPending;

  // -- "Check your email" confirmation state ----------------------------------
  if (awaitingConfirm) {
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
            <View style={styles.identity}>
              <NaraLogo size="large" showWordmark={false} />
            </View>

            <View style={styles.form}>
              <Text style={styles.confirmHeading}>Check your email</Text>
              <Text style={styles.confirmSubtext}>
                We sent a confirmation link to{' '}
                <Text style={styles.confirmEmail}>{email.trim()}</Text>. Tap it to
                activate your account, then come back and sign in.
              </Text>

              <TouchableOpacity
                style={styles.cta}
                onPress={handleBackToSignIn}
                activeOpacity={0.85}
              >
                <Text style={styles.ctaLabel}>Back to sign in</Text>
              </TouchableOpacity>

              <View style={styles.resendRow}>
                <TouchableOpacity
                  onPress={() => {
                    setResentMsg(null);
                    resendConfirmation.mutate();
                  }}
                  disabled={resendConfirmation.isPending}
                >
                  <Text style={styles.linkText}>
                    {resendConfirmation.isPending ? 'Sending...' : 'Resend email'}
                  </Text>
                </TouchableOpacity>
              </View>

              {resentMsg ? (
                <Text style={styles.resentText}>{resentMsg}</Text>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // -- Main sign in / sign up form --------------------------------------------
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
          {/* -- Identity block ------------------------------------------------ */}
          <View style={styles.identity}>
            <NaraLogo size="large" showWordmark={false} />
            <Text style={styles.wordmark}>Nara</Text>
            <Text style={styles.tagline}>Just talk. Nara remembers.</Text>
          </View>

          {/* -- Form ---------------------------------------------------------- */}
          <View style={styles.form}>
            {mode === 'signup' ? (
              <TextInput
                style={[styles.input, errorMsg ? styles.inputError : null]}
                placeholder="Your name"
                placeholderTextColor={colors.faint}
                autoCapitalize="words"
                autoComplete="name"
                autoCorrect={false}
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  if (errorMsg) setErrorMsg(null);
                }}
                editable={!isPending}
              />
            ) : null}

            <TextInput
              style={[styles.input, errorMsg ? styles.inputError : null]}
              placeholder="your@email.com"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              value={email}
              onChangeText={handleEmailChange}
              editable={!isPending}
            />

            <TextInput
              style={[styles.input, errorMsg ? styles.inputError : null]}
              placeholder="Password"
              placeholderTextColor={colors.faint}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                if (errorMsg) setErrorMsg(null);
              }}
              editable={!isPending}
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <TouchableOpacity
              style={[styles.cta, isPending && styles.ctaDisabled]}
              onPress={handleSubmit}
              disabled={isPending}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaLabel}>
                {isPending
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : 'Signing up...'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Sign up'}
              </Text>
            </TouchableOpacity>

            {/* -- Toggle sign in / sign up ------------------------------------ */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>
                {mode === 'signin'
                  ? "Don't have an account?"
                  : 'Already have an account?'}
              </Text>
              <TouchableOpacity onPress={handleToggleMode} disabled={isPending}>
                <Text style={styles.toggleLink}>
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
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

  // -- Identity
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

  // -- Form
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

  // -- Toggle row
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  toggleText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '400',
    color: colors.subInk,
  },
  toggleLink: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },

  // -- Confirmation state
  confirmHeading: {
    fontFamily: fontFamily.grotesk,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  confirmSubtext: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '400',
    color: colors.subInk,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  confirmEmail: {
    fontWeight: '600',
    color: colors.ink,
  },
  resendRow: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  linkText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '500',
    color: colors.subInk,
  },
  resentText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '500',
    color: colors.accent,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
