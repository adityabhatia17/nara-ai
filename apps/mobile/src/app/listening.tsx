/**
 * Listening Screen — Phase 1 (text input)
 *
 * Phase 1 replaces the microphone flow with a text input:
 *   - Multiline TextInput ("Tell Nara what's on your mind…")
 *   - Character counter  current / 20 000
 *   - Submit button → POST /entries → navigate to /processing?entryId=...
 *
 * Design tokens: paper bg, Schibsted Grotesk, ink / cobalt / subInk palette.
 * No tab bar (full-screen modal in root stack).
 * StatusBar hidden.
 *
 * Spec: docs/CLAUDE_FRONTEND.md § Screen 2 "Listening"
 */

import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { colors, typography, spacing, radius, fontFamily } from '@/theme/tokens';
import { useAppStore } from '@/store/app';
import type { CreateEntryResponse } from '@nara/shared';

const MAX_CHARS = 20000;

export default function ListeningScreen() {
  const router = useRouter();
  const { setRecordingState } = useAppStore();
  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // ── POST /entries mutation ────────────────────────────────────────────────
  const submitMutation = useMutation({
    mutationFn: async (inputText: string) => {
      const res = await api.post<CreateEntryResponse>('/entries', {
        text: inputText,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setRecordingState('processing');
      // Pass entryId to processing screen so it can poll status
      router.replace({
        pathname: '/processing',
        params: { entryId: data.entry_id },
      });
    },
  });

  const canSubmit = text.trim().length > 0 && text.length <= MAX_CHARS;
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHARS;

  const handleSubmit = () => {
    if (!canSubmit || submitMutation.isPending) return;
    submitMutation.mutate(text.trim());
  };

  const handleClose = () => {
    setRecordingState('idle');
    router.back();
  };

  return (
    <>
      <StatusBar hidden />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Nara is listening</Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>
        </View>

        {/* ── Text input area ──────────────────────────────────────────── */}
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Tell Nara what's on your mind…"
            placeholderTextColor={colors.inactive}
            multiline
            autoFocus
            scrollEnabled={false}
            maxLength={MAX_CHARS + 50} // soft warn before hard block
            textAlignVertical="top"
            accessibilityLabel="Entry text input"
          />
        </ScrollView>

        {/* ── Footer: char counter + submit ───────────────────────────── */}
        <View style={styles.footer}>
          <Text style={[styles.charCounter, isOverLimit && styles.charCounterOver]}>
            {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
          </Text>

          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit || submitMutation.isPending}
            style={({ pressed }) => [
              styles.submitButton,
              (!canSubmit || submitMutation.isPending) && styles.submitButtonDisabled,
              pressed && canSubmit && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Submit entry"
          >
            {submitMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.paper} />
            ) : (
              <Text style={styles.submitLabel}>Done</Text>
            )}
          </Pressable>
        </View>

        {/* ── Error ───────────────────────────────────────────────────── */}
        {submitMutation.isError && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>
              {submitMutation.error instanceof Error
                ? submitMutation.error.message
                : 'Something went wrong. Please try again.'}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.statusBar,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  headerLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.subInk,
    fontFamily: fontFamily.grotesk,
    letterSpacing: 0,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.circle,
    backgroundColor: colors.border.card as string,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 13,
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
    fontWeight: '600',
  },

  // Input
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    flexGrow: 1,
  },
  input: {
    flex: 1,
    minHeight: 200,
    fontSize: typography.voice.fontSize,
    fontWeight: '400',
    fontStyle: 'italic',
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
    lineHeight: typography.voice.fontSize * (typography.voice.lineHeight ?? 1.5),
    letterSpacing: 0,
    // no border — clean editorial feel
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xl + spacing.lg, // extra safe-area buffer
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.card as string,
  },
  charCounter: {
    fontSize: typography.meta.fontSize,
    fontWeight: '500',
    color: colors.faint,
    fontFamily: fontFamily.grotesk,
  },
  charCounterOver: {
    color: '#D24E6E', // rose — error
  },
  submitButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    minWidth: 80,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.inactive,
  },
  submitLabel: {
    fontSize: typography.body.fontSize,
    fontWeight: '600',
    color: colors.paper,
    fontFamily: fontFamily.grotesk,
  },

  // Error banner
  errorBanner: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    backgroundColor: '#F8E2E8',
    borderRadius: radius.card,
    padding: spacing.md,
  },
  errorText: {
    fontSize: typography.meta.fontSize,
    color: '#D24E6E',
    fontFamily: fontFamily.grotesk,
    fontWeight: '500',
  },
});
