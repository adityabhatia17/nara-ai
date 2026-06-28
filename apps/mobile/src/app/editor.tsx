/**
 * Editor Screen — TenTap Rich Text Editor (@10play/tentap-editor)
 *
 * Supports both "New Note" and "Edit Note" modes.
 * - New: POST /entries → triggers AI pipeline (extract, categorize, embed)
 * - Edit: PUT /notes/:id → updates existing note content
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RichText,
  Toolbar,
  useEditorBridge,
  useEditorContent,
  TenTapStartKit,
  CoreBridge,
  PlaceholderBridge,
  DEFAULT_TOOLBAR_ITEMS,
} from '@10play/tentap-editor';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { colors, fontFamily } from '@/theme/tokens';
import { api } from '@/lib/api';

const editorCSS = `
* {
  font-family: '${fontFamily.grotesk}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: ${colors.body};
}
body {
  background-color: ${colors.paper};
  padding: 0 24px;
  margin: 0;
}
.ProseMirror {
  outline: none;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
}
.ProseMirror p { margin: 0.5em 0; }
.ProseMirror strong { font-weight: 700; }
.ProseMirror em { font-style: italic; }
.ProseMirror u { text-decoration: underline; }
.ProseMirror ul, .ProseMirror ol { padding-left: 1.5em; margin: 0.5em 0; }
.ProseMirror li { margin: 0.25em 0; }
.ProseMirror h1, .ProseMirror h2, .ProseMirror h3 {
  font-weight: 700;
  margin: 0.5em 0 0.25em 0;
  line-height: 1.2;
}
.ProseMirror h1 { font-size: 24px; }
.ProseMirror h2 { font-size: 20px; }
.ProseMirror h3 { font-size: 17px; }
.ProseMirror p.is-editor-empty:first-child::before {
  color: ${colors.faint};
}
`;

/**
 * Curated toolbar items, reordered from DEFAULT_TOOLBAR_ITEMS.
 * Order: Heading (4), Bold (0), Italic (1), Bullet list (10),
 *        Ordered list (9), Checklist (3), Blockquote (8)
 *
 * DEFAULT_TOOLBAR_ITEMS indices (from @10play/tentap-editor v1.x):
 *  0=Bold, 1=Italic, 2=Link, 3=TaskList, 4=Heading,
 *  5=Code, 6=Underline, 7=Strikethrough, 8=Blockquote,
 *  9=OrderedList, 10=BulletList, 11=Indent, 12=Outdent,
 *  13=Undo, 14=Redo
 */
const CURATED_TOOLBAR_ITEMS = [
  DEFAULT_TOOLBAR_ITEMS[4],  // Heading (opens H1-H6 sub-toolbar)
  DEFAULT_TOOLBAR_ITEMS[0],  // Bold
  DEFAULT_TOOLBAR_ITEMS[1],  // Italic
  DEFAULT_TOOLBAR_ITEMS[10], // Bullet list
  DEFAULT_TOOLBAR_ITEMS[9],  // Ordered list
  DEFAULT_TOOLBAR_ITEMS[3],  // Checklist / Task list
  DEFAULT_TOOLBAR_ITEMS[8],  // Blockquote
];

export default function EditorScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { noteId, initialContent, mode } = useLocalSearchParams<{
    noteId?: string;
    initialContent?: string;
    mode?: string;
  }>();

  const isAppendMode = mode === 'append';
  const isEditMode = !!noteId && !isAppendMode;

  const [isSaving, setIsSaving] = useState(false);
  const savedToastOpacity = useRef(new Animated.Value(0)).current;

  const editor = useEditorBridge({
    autofocus: true,
    avoidIosKeyboard: true,
    initialContent: isAppendMode ? '' : (initialContent || ''),
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({
        placeholder: 'Start writing…',
      }),
      CoreBridge.configureCSS(editorCSS),
    ],
    theme: {
      toolbar: {
        toolbarBody: {
          borderTopColor: 'rgba(20,22,24,0.07)',
          borderTopWidth: 1,
          backgroundColor: colors.paper,
        },
        toolbarButton: {
          backgroundColor: 'transparent',
        },
        icon: {
          tintColor: colors.body,
        },
        iconActive: {
          tintColor: colors.accent,
        },
        iconWrapperActive: {
          backgroundColor: 'rgba(46,80,230,0.08)',
        },
        iconDisabled: {
          tintColor: colors.faint,
        },
      },
      webview: {
        backgroundColor: colors.paper,
      },
    },
  });

  const textContent = useEditorContent(editor, {
    type: 'text',
    debounceInterval: 200,
  });

  const hasContent = !!(textContent && textContent.trim());

  const saveMutation = useMutation({
    mutationFn: async (text: string) => {
      if (isAppendMode && noteId) {
        await api.post(`/notes/${noteId}/append`, { text });
      } else if (isEditMode && noteId) {
        await api.put(`/notes/${noteId}`, { content: text });
      } else {
        await api.post('/entries', { text });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      if (noteId) {
        queryClient.invalidateQueries({ queryKey: ['note', noteId] });
      }
      Animated.sequence([
        Animated.timing(savedToastOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(savedToastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        router.back();
      });
    },
    onError: (error) => {
      console.error('Save failed:', error);
      setIsSaving(false);
      Alert.alert('Could not save', 'Something went wrong. Please try again.', [
        { text: 'OK' },
      ]);
    },
  });

  const handleSave = useCallback(async () => {
    if (!hasContent) {
      Alert.alert('Empty note', 'Write something before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const text = await editor.getText();
      const trimmed = text.trim();
      if (!trimmed) {
        Alert.alert('Empty note', 'Write something before saving.');
        setIsSaving(false);
        return;
      }
      saveMutation.mutate(trimmed);
    } catch {
      setIsSaving(false);
    }
  }, [hasContent, editor, saveMutation]);

  const handleCancel = useCallback(() => {
    if (hasContent) {
      Alert.alert('Discard note?', 'Your changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]);
    } else {
      router.back();
    }
  }, [hasContent, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleCancel}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isAppendMode ? 'Add to note' : isEditMode ? 'Edit note' : 'New note'}
        </Text>

        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={isSaving || !hasContent}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text
              style={[
                styles.saveButton,
                !hasContent && styles.saveButtonDisabled,
              ]}
            >
              Save
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Editor fills remaining space */}
      <RichText editor={editor} style={styles.richText} />

      {/* Toolbar — absolute bottom, follows keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.toolbarWrapper,
          { paddingBottom: insets.bottom },
        ]}
      >
        <Toolbar editor={editor} items={CURATED_TOOLBAR_ITEMS} />
      </KeyboardAvoidingView>

      {/* Save success toast */}
      <Animated.View
        style={[styles.toast, { opacity: savedToastOpacity }]}
        pointerEvents="none"
      >
        <Text style={styles.toastText}>Saved</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,22,24,0.07)',
    backgroundColor: colors.paper,
  },
  cancelButton: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '500',
    color: colors.secondary,
    minWidth: 50,
  },
  headerTitle: {
    fontFamily: fontFamily.grotesk,
    fontSize: 17,
    fontWeight: '600',
    color: colors.ink,
  },
  saveButton: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '600',
    color: colors.accent,
    minWidth: 50,
    textAlign: 'right',
  },
  saveButtonDisabled: {
    opacity: 0.35,
  },
  richText: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  toolbarWrapper: {
    position: 'absolute',
    width: '100%',
    bottom: 0,
    backgroundColor: colors.paper,
  },
  toast: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: colors.ink,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  toastText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '600',
    color: colors.card,
  },
});
