/**
 * Login Screen -- Email OTP (two-step flow)
 *
 * Step 1: User enters email, taps "Send code".
 *         Calls supabase.auth.signInWithOtp({ email, shouldCreateUser: true }).
 *
 * Step 2: User enters the 6-digit code from their inbox, taps "Verify".
 *         Calls supabase.auth.verifyOtp({ email, token, type: 'email' }).
 *         On success the session is set; onAuthStateChange in useSession
 *         auto-routes into the app.
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

export default function LoginScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // -- Request OTP code -------------------------------------------------------
  const requestCode = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setErrorMsg(null);
      setStep('code');
    },
    onError: (e: any) => setErrorMsg(e?.message ?? 'Could not send code'),
  });

  // -- Verify OTP code --------------------------------------------------------
  const verifyCode = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: 'email',
      });
      if (error) throw error;
      // Session is now set; onAuthStateChange in useSession handles routing.
    },
    onError: (e: any) => setErrorMsg(e?.message ?? 'Invalid or expired code'),
  });

  // -- Validation + submit ----------------------------------------------------
  const handleSendCode = () => {
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
    requestCode.mutate();
  };

  const handleVerify = () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setErrorMsg('Please enter the 6-digit code.');
      return;
    }
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      setErrorMsg('Code must be exactly 6 digits.');
      return;
    }
    setErrorMsg(null);
    verifyCode.mutate();
  };

  const handleCodeChange = (v: string) => {
    // Only allow digits
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (errorMsg) setErrorMsg(null);
    // Auto-submit when 6 digits entered
    if (digits.length === 6) {
      setErrorMsg(null);
      verifyCode.mutate();
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setErrorMsg(null);
  };

  const isPending = requestCode.isPending || verifyCode.isPending;

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
          {step === 'email' ? (
            <>
              {/* -- Identity block ------------------------------------------ */}
              <View style={styles.identity}>
                <NaraLogo size="large" showWordmark={false} />
                <Text style={styles.wordmark}>Nara</Text>
                <Text style={styles.tagline}>Just talk. Nara remembers.</Text>
              </View>

              {/* -- Email form ---------------------------------------------- */}
              <View style={styles.form}>
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

                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                <TouchableOpacity
                  style={[styles.cta, isPending && styles.ctaDisabled]}
                  onPress={handleSendCode}
                  disabled={isPending}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaLabel}>
                    {requestCode.isPending ? 'Sending...' : 'Send code'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {/* -- Code entry ---------------------------------------------- */}
              <View style={styles.form}>
                <Text style={styles.codeHeading}>Enter your code</Text>
                <Text style={styles.codeSubtext}>
                  We sent a 6-digit code to {email.trim()}.
                </Text>

                <TextInput
                  style={[styles.codeInput, errorMsg ? styles.inputError : null]}
                  placeholder="000000"
                  placeholderTextColor={colors.faint}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChangeText={handleCodeChange}
                  editable={!isPending}
                />

                {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

                <TouchableOpacity
                  style={[styles.cta, isPending && styles.ctaDisabled]}
                  onPress={handleVerify}
                  disabled={isPending}
                  activeOpacity={0.85}
                >
                  <Text style={styles.ctaLabel}>
                    {verifyCode.isPending ? 'Verifying...' : 'Verify'}
                  </Text>
                </TouchableOpacity>

                {/* -- Secondary actions ------------------------------------- */}
                <View style={styles.secondaryActions}>
                  <TouchableOpacity onPress={handleBackToEmail} disabled={isPending}>
                    <Text style={styles.linkText}>Use a different email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => { setErrorMsg(null); requestCode.mutate(); }}
                    disabled={isPending}
                  >
                    <Text style={styles.linkText}>
                      {requestCode.isPending ? 'Sending...' : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
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

  // -- Code step
  codeHeading: {
    fontFamily: fontFamily.grotesk,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  codeSubtext: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '400',
    color: colors.subInk,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  codeInput: {
    height: 56,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.interactive,
    paddingHorizontal: spacing.lg,
    fontSize: 28,
    fontFamily: fontFamily.grotesk,
    color: colors.ink,
    textAlign: 'center',
    letterSpacing: 8,
  },

  // -- Secondary actions
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  linkText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '500',
    color: colors.subInk,
  },
});
