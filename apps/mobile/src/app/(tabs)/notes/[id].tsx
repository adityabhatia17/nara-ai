/**
 * Note Detail Screen
 * Pixel-matched to Nara.dc.html NOTE DETAIL block.
 * Two text action buttons navigate to the editor in edit mode.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatTimestamp } from '@/lib/format';
import { colors, fontFamily, getCategoryColor } from '@/theme/tokens';
import type { NoteDetail } from '@nara/shared';

export default function NoteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data: note, isLoading, error } = useQuery({
    queryKey: ['note', id],
    queryFn: async () => {
      const response = await api.get<NoteDetail>(`/notes/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  // --- Loading ---
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </View>
    );
  }

  // --- Error / not found ---
  if (error || !note) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <TouchableOpacity
            style={styles.backRow}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.backChevron}>{'‹'}</Text>
            <Text style={styles.backLabel}>Notes</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Note not found</Text>
        </View>
      </View>
    );
  }

  const firstCategory = note.categories.length > 0 ? note.categories[0] : null;
  const catColor = firstCategory ? getCategoryColor(firstCategory.name, 'base') : colors.faint;
  const catLabel = firstCategory?.name ?? '';
  const timestamp = formatTimestamp(note.created_at);

  const navigateToEditor = () => {
    router.push({
      pathname: '/editor',
      params: { noteId: id, initialContent: note.content },
    });
  };

  return (
    <View style={styles.container}>
      {/* Header: back button */}
      <View style={styles.headerBlock}>
        <TouchableOpacity
          style={styles.backRow}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.backChevron}>{'‹'}</Text>
          <Text style={styles.backLabel}>Notes</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable body */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Meta row: category dot + label + spacer + time */}
        <View style={styles.metaRow}>
          {firstCategory && (
            <>
              <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
              <Text style={[styles.categoryLabel, { color: catColor }]}>
                {catLabel}
              </Text>
            </>
          )}
          <View style={styles.spacer} />
          <Text style={styles.timestamp}>{timestamp}</Text>
        </View>

        {/* Note text */}
        <Text style={styles.noteText}>{note.content}</Text>

        {/* Context box */}
        <View style={styles.contextBox}>
          {/* Nara mark: 20x20 ink square with 6x6 cobalt circle */}
          <View style={styles.naraMark}>
            <View style={styles.naraMarkDot} />
          </View>
          <Text style={styles.contextText}>
            Filed to your {catLabel} thread. Add to it any time.
          </Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={navigateToEditor}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Add to note</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={navigateToEditor}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Edit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

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
  errorText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
  },

  /* Header: padding 58 top, 24 horizontal, 10 bottom */
  headerBlock: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 10,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  backChevron: {
    fontFamily: fontFamily.grotesk,
    fontSize: 19,
    color: '#6A6E73',
    lineHeight: 19,
  },
  backLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '500',
    color: '#6A6E73',
  },

  /* Body: padding 18 top, 24 horizontal, 122 bottom */
  body: {
    paddingTop: 18,
    paddingHorizontal: 24,
    paddingBottom: 122,
  },

  /* Meta row */
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  categoryLabel: {
    fontFamily: fontFamily.grotesk,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  spacer: {
    flex: 1,
  },
  timestamp: {
    fontFamily: fontFamily.grotesk,
    fontSize: 12.5,
    color: '#9A9DA1',
  },

  /* Note text */
  noteText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 23,
    fontWeight: '600',
    lineHeight: 23 * 1.42,
    letterSpacing: -0.4,
    color: '#18191B',
  },

  /* Context box */
  contextBox: {
    marginTop: 24,
    backgroundColor: 'rgba(46,80,230,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
  },
  naraMark: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#18191B',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  naraMarkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2E50E6',
  },
  contextText: {
    flex: 1,
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 14 * 1.5,
    color: '#4D5560',
  },

  /* Action row */
  actionRow: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#18191B',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '600',
    color: '#F3F3F1',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '600',
    color: '#4D5560',
  },
});
