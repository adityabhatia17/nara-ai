/**
 * Note Detail Screen
 * Full note text, Nara context box, append (text) and edit flows.
 * Phase 1: voice append hidden. Tab bar visible (inside tabs navigator).
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatTimestamp } from '@/lib/format';
import { colors, typography, spacing, radius, fontFamily } from '@/theme/tokens';
import { PrimaryButton, SecondaryButton } from '@/components/Button';
import CategoryPill from '@/components/CategoryPill';
import type { NoteDetail, AppendNoteRequest, UpdateNoteRequest } from '@nara/shared';

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [appendOpen, setAppendOpen] = useState(false);
  const [appendText, setAppendText] = useState('');

  // Fetch note
  const { data: note, isLoading, error } = useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      const response = await api.get<NoteDetail>(`/notes/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // Seed edit text when note first loads
  useEffect(() => {
    if (note && !editText) setEditText(note.content);
  }, [note?.id]);

  // Edit mutation (PUT /notes/:id)
  const updateMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.put<NoteDetail>(
        `/notes/${id}`,
        { content } satisfies UpdateNoteRequest,
      );
      return response.data;
    },
    onMutate: async (content) => {
      await queryClient.cancelQueries({ queryKey: ['note', id] });
      const previous = queryClient.getQueryData<NoteDetail>(['note', id]);
      if (previous) {
        queryClient.setQueryData<NoteDetail>(['note', id], {
          ...previous,
          content,
          updated_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (_err, _content, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['note', id], context.previous);
      }
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(['note', id], updatedNote);
      setEditText(updatedNote.content);
      setEditMode(false);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['note', id] }),
  });

  // Append mutation (POST /notes/:id/append)
  const appendMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await api.post<NoteDetail>(
        `/notes/${id}/append`,
        { text } satisfies AppendNoteRequest,
      );
      return response.data;
    },
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey: ['note', id] });
      const previous = queryClient.getQueryData<NoteDetail>(['note', id]);
      if (previous) {
        queryClient.setQueryData<NoteDetail>(['note', id], {
          ...previous,
          content: `${previous.content}\n\n${text}`,
          updated_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (_err, _text, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['note', id], context.previous);
      }
    },
    onSuccess: (updatedNote) => {
      queryClient.setQueryData(['note', id], updatedNote);
      setEditText(updatedNote.content);
      setAppendOpen(false);
      setAppendText('');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['note', id] }),
  });

  const handleSaveEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === note?.content) {
      setEditMode(false);
      return;
    }
    updateMutation.mutate(trimmed);
  }, [editText, note?.content]);

  const handleAppend = useCallback(() => {
    const trimmed = appendText.trim();
    if (!trimmed) return;
    appendMutation.mutate(trimmed);
  }, [appendText]);

  // --- Loading ---
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // --- Error / not found ---
  if (error || !note) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.backText}>‹ Notes</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.errorText}>Note not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const timestamp = formatTimestamp(note.created_at);

  // --- Append inline panel ---
  if (appendOpen) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Header */}
          <View style={styles.appendHeader}>
            <Text style={styles.appendTitle}>Add to this note</Text>
            <TouchableOpacity
              onPress={() => { setAppendOpen(false); setAppendText(''); }}
              activeOpacity={0.7}
            >
              <Text style={styles.appendCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Input */}
          <TextInput
            style={styles.appendInput}
            value={appendText}
            onChangeText={setAppendText}
            multiline
            placeholder="Add more context…"
            placeholderTextColor={colors.faint}
            autoFocus
            textAlignVertical="top"
          />

          {/* Save */}
          <View style={styles.appendFooter}>
            <PrimaryButton
              label={appendMutation.isPending ? '' : 'Add'}
              onPress={handleAppend}
              disabled={!appendText.trim() || appendMutation.isPending}
              loading={appendMutation.isPending}
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- Main view ---
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.backText}>‹ Notes</Text>
          </TouchableOpacity>

          {/* Metadata row */}
          <View style={styles.metaRow}>
            {note.categories.length > 0 && (
              <CategoryPill name={note.categories[0].name} />
            )}
            <Text style={styles.timestamp}>{timestamp}</Text>
          </View>

          {/* Note body — editable or read-only */}
          {editMode ? (
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              textAlignVertical="top"
              placeholder="Note content"
              placeholderTextColor={colors.faint}
              autoFocus
            />
          ) : (
            <Text style={styles.noteContent}>{note.content}</Text>
          )}

          {/* Nara context box */}
          {!!note.nara_context && (
            <View style={styles.contextBox}>
              <Text style={styles.contextText}>{note.nara_context}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {editMode ? (
              <View style={styles.editActions}>
                <SecondaryButton
                  label="Cancel"
                  onPress={() => {
                    setEditMode(false);
                    setEditText(note.content);
                  }}
                  style={styles.actionHalf}
                />
                <PrimaryButton
                  label="Save"
                  onPress={handleSaveEdit}
                  disabled={!editText.trim() || editText.trim() === note.content}
                  loading={updateMutation.isPending}
                  style={styles.actionHalf}
                />
              </View>
            ) : (
              <View style={styles.normalActions}>
                <PrimaryButton
                  label="Add to this note"
                  onPress={() => setAppendOpen(true)}
                />
                <SecondaryButton
                  label="Edit"
                  onPress={() => {
                    setEditText(note.content);
                    setEditMode(true);
                  }}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.tabBar,
  },

  // Back button
  backBtn: {
    marginBottom: spacing.lg,
  },
  backText: {
    fontSize: typography.meta.fontSize,
    fontWeight: typography.meta.fontWeight as any,
    color: colors.subInk,
    fontFamily: fontFamily.grotesk,
  },

  // Metadata row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  timestamp: {
    fontSize: typography.meta.fontSize,
    fontWeight: typography.meta.fontWeight as any,
    color: colors.faint,
    fontFamily: fontFamily.grotesk,
  },

  // Note body
  noteContent: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight as any,
    lineHeight: typography.body.lineHeight as any,
    color: colors.body,
    fontFamily: fontFamily.grotesk,
    marginBottom: spacing.xl,
  },

  // Edit input
  editInput: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight as any,
    lineHeight: typography.body.lineHeight as any,
    color: colors.body,
    fontFamily: fontFamily.grotesk,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.interactive,
    padding: spacing.lg,
    minHeight: 140,
    marginBottom: spacing.xl,
  },

  // Nara context box — white card with 2px cobalt left border
  contextBox: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border.card,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.lg,
    paddingLeft: spacing.lg,
    paddingRight: spacing.lg,
    marginBottom: spacing.xl,
  },
  contextText: {
    fontSize: typography.voice.fontSize,
    fontStyle: 'italic',
    fontWeight: typography.voice.fontWeight as any,
    lineHeight: typography.voice.lineHeight as any,
    color: colors.subInk,
    fontFamily: fontFamily.grotesk,
  },

  // Actions
  actions: {
    marginTop: spacing.sm,
  },
  normalActions: {
    gap: spacing.md,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionHalf: {
    flex: 1,
  },

  // Error
  errorText: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight as any,
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
  },

  // Append panel
  appendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.card,
  },
  appendTitle: {
    fontSize: typography.body.fontSize,
    fontWeight: '600' as any,
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
  },
  appendCancel: {
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight as any,
    color: colors.accent,
    fontFamily: fontFamily.grotesk,
  },
  appendInput: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight as any,
    color: colors.body,
    fontFamily: fontFamily.grotesk,
    lineHeight: typography.body.lineHeight as any,
  },
  appendFooter: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.tabBar,
    paddingTop: spacing.md,
  },
});
