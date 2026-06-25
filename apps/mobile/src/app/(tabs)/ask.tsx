/**
 * Ask Nara Screen -- Ask tab
 * Chat interface for asking questions about your notes.
 *
 * Design (from Nara.dc.html lines 229-262):
 *   Title: "Ask Nara" -- 32px, weight 700, tracking -0.8, ink
 *   Subtitle: "She's read everything you've shared." -- 13px, weight 400, #9A9DA1
 *   Header: border-bottom 1px solid rgba(20,22,24,0.07)
 *   Chat area: padding 20px
 *   Suggestion chips: inline-flex, padding 9px 14px, white bg, 1px border rgba(20,22,24,0.12),
 *                     radius 999, 13px weight 500, color #4D5560
 *   Input bar: flex row, padding 12px 14px 12px 18px, white bg, 1px border rgba(20,22,24,0.12),
 *              radius 999, placeholder 14px #9A9DA1, send 32px cobalt circle with white arrow
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { colors, spacing, fontFamily } from '@/theme/tokens';
import { api } from '@/lib/api';
import { AskResponse, AskRequest } from '@nara/shared';
import { ChatBubble } from '@/components/chat-bubble';
import { TypingDots } from '@/components/typing-dots';

// -- Types -------------------------------------------------------------------

interface Message {
  id: string;
  role: 'user' | 'nara';
  text: string;
  timestamp: Date;
  cited_note_ids?: string[];
}

// -- Constants ---------------------------------------------------------------

const SUGGESTION_CHIPS = [
  "What did I say about work lately?",
  "How's Rohan been?",
  "What books have I mentioned?",
];

const ERROR_MESSAGE_429 =
  "You've been asking a lot of questions. Try again in a minute.";
const ERROR_MESSAGE_503 =
  "Nara is thinking harder than usual. Try in a moment.";
const ERROR_MESSAGE_DEFAULT =
  "Something went wrong. Try again.";

// -- Screen ------------------------------------------------------------------

const TAB_BAR_HEIGHT = 80;

export default function AskScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const insets = useSafeAreaInsets();

  const flatListRef = useRef<FlatList<Message>>(null);
  const bottomPadding = TAB_BAR_HEIGHT + insets.bottom;

  const addMessage = useCallback((msg: Message) => {
    setMessages((prev) => [msg, ...prev]);
  }, []);

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const response = await api.post<AskResponse>('/ask', {
        question,
      } as AskRequest);
      return response.data;
    },
    onMutate: (question) => {
      addMessage({
        id: `user-${Date.now()}`,
        role: 'user',
        text: question,
        timestamp: new Date(),
      });
      setIsTyping(true);
    },
    onSuccess: (data) => {
      setIsTyping(false);
      addMessage({
        id: `nara-${Date.now()}`,
        role: 'nara',
        text: data.answer,
        timestamp: new Date(),
        cited_note_ids: data.cited_note_ids,
      });
    },
    onError: (error: any) => {
      setIsTyping(false);
      const text =
        error?.status === 429
          ? ERROR_MESSAGE_429
          : error?.status === 503
          ? ERROR_MESSAGE_503
          : ERROR_MESSAGE_DEFAULT;

      addMessage({
        id: `error-${Date.now()}`,
        role: 'nara',
        text,
        timestamp: new Date(),
      });
    },
  });

  const handleSend = useCallback(
    (overrideText?: string) => {
      const question = (overrideText ?? input).trim();
      if (!question || askMutation.isPending) return;

      setInput('');
      askMutation.mutate(question);
    },
    [input, askMutation]
  );

  const handleChipPress = useCallback(
    (chip: string) => {
      handleSend(chip);
    },
    [handleSend]
  );

  // -- Render helpers --------------------------------------------------------

  const renderMessage = ({ item }: { item: Message }) => (
    <ChatBubble message={item.text} variant={item.role === 'user' ? 'user' : 'nara'} />
  );

  const renderListHeader = () => {
    if (!isTyping) return null;
    return (
      <View style={styles.typingRow}>
        <View style={styles.typingBubble}>
          <TypingDots />
        </View>
      </View>
    );
  };

  // -- Layout ----------------------------------------------------------------

  const hasMessages = messages.length > 0 || isTyping;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header with border-bottom */}
        <View style={styles.header}>
          <Text style={styles.title}>Ask Nara</Text>
          <Text style={styles.subtitle}>She's read everything you've shared.</Text>
        </View>

        {/* Chat thread */}
        {hasMessages && (
          <FlatList<Message>
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            inverted
            style={styles.chatList}
            contentContainerStyle={styles.chatContent}
            ListHeaderComponent={renderListHeader}
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Spacer -- pushes input bar down when no messages */}
        {!hasMessages && <View style={styles.spacer} />}

        {/* Suggestion chips + input bar area */}
        <View style={[styles.bottomArea, { paddingBottom: bottomPadding }]}>
          {/* Suggestion chips -- shown only when no conversation yet */}
          {!hasMessages && (
            <View style={styles.chipsRow}>
              {SUGGESTION_CHIPS.map((chip) => (
                <TouchableOpacity
                  key={chip}
                  style={styles.chip}
                  onPress={() => handleChipPress(chip)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.chipText}>{chip}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Input bar */}
          <View style={styles.inputBar}>
            <TextInput
              style={styles.input}
              placeholder="Ask about anything you've said..."
              placeholderTextColor="#9A9DA1"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!askMutation.isPending}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => handleSend()}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!input.trim() || askMutation.isPending) && styles.sendButtonDisabled,
              ]}
              onPress={() => handleSend()}
              disabled={!input.trim() || askMutation.isPending}
              activeOpacity={0.8}
            >
              <Text style={styles.sendIcon}>↑</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  keyboardView: {
    flex: 1,
  },

  // -- Header ----------------------------------------------------------------
  header: {
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(20,22,24,0.07)',
  },
  title: {
    fontFamily: fontFamily.grotesk,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#18191B',
  },
  subtitle: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '400',
    color: '#9A9DA1',
    marginTop: 4,
  },

  // -- Chat thread -----------------------------------------------------------
  chatList: {
    flex: 1,
  },
  chatContent: {
    paddingTop: 16,
    paddingBottom: 10,
  },

  // -- Typing indicator ------------------------------------------------------
  typingRow: {
    paddingHorizontal: 20,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  typingBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 5,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },

  spacer: {
    flex: 1,
  },

  // -- Bottom area (chips + input) -------------------------------------------
  bottomArea: {
    flexShrink: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
  },

  // -- Suggestion chips ------------------------------------------------------
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.12)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 6,
    marginBottom: 8,
  },
  chipText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '500',
    color: '#4D5560',
  },

  // -- Input bar -------------------------------------------------------------
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    paddingRight: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.12)',
    borderRadius: 999,
    marginTop: 6,
    gap: 10,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.grotesk,
    fontSize: 14,
    fontWeight: '400',
    color: '#18191B',
    paddingVertical: 0,
    maxHeight: 120,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: '#2E50E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    fontFamily: fontFamily.grotesk,
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 18,
    marginTop: -1,
  },
});
