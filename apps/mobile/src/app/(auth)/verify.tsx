/**
 * Verify Screen
 * OTP verification after magic link clicked.
 * Supabase redirects here; user enters OTP, then navigates to home on success.
 */

import { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { colors, typography, spacing, radius } from '@/theme/tokens';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { PrimaryButton } from '@/components/primary-button';

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState('');

  // Handle deep link from magic link email
  useEffect(() => {
    const handleDeepLink = async () => {
      // Supabase will handle the token in the URL and set the session
      // Check if user is already authenticated (redirected after clicking magic link)
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // User is authenticated, go to home
        router.replace('/(tabs)');
      }
    };

    handleDeepLink();
  }, [router]);

  const verifyOtpMutation = useMutation({
    mutationFn: async (token: string) => {
      // Exchange OTP token for session via Supabase
      const { error, data } = await supabase.auth.verifyOtp({
        token,
        type: 'email',
        email: params.email as string,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // OTP verified, navigate to home
      router.replace('/(tabs)');
    },
    onError: (error: any) => {
      Alert.alert('Invalid OTP', error?.message || 'The code you entered is invalid or expired.');
    },
  });

  const handleVerifyOtp = () => {
    if (!otp.trim()) {
      Alert.alert('Code required', 'Please enter the verification code.');
      return;
    }
    verifyOtpMutation.mutate(otp.trim());
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerSection}>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>Enter the code we sent to your inbox</Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.label}>Verification Code</Text>
          <TextInput
            style={styles.input}
            placeholder="000000"
            placeholderTextColor={colors.faint}
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={6}
            editable={!verifyOtpMutation.isPending}
          />

          <PrimaryButton
            label="Verify"
            onPress={handleVerifyOtp}
            loading={verifyOtpMutation.isPending}
            disabled={verifyOtpMutation.isPending}
          />

          <Text style={styles.helper}>Check your email for the 6-digit code</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  headerSection: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.display,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.subInk,
  },
  formSection: {
    gap: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.ink,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border.interactive,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    fontSize: typography.display.fontSize,
    color: colors.ink,
    fontFamily: 'SchibstedGrotesk',
    textAlign: 'center',
    letterSpacing: 8,
  },
  helper: {
    ...typography.meta,
    color: colors.faint,
    textAlign: 'center',
  },
});
