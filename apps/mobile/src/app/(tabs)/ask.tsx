/**
 * Ask Nara Screen -- Ask tab
 * Chat interface for asking questions about your notes.
 *
 * Design (pixel-matched to Nara.dc.html ASK NARA block, lines 229-262):
 *   Header: paddingTop 60, paddingHorizontal 24, paddingBottom 14,
 *           borderBottom 1px rgba(20,22,24,0.07)
 *   Title: "Ask Nara" 32px 700 -0.8 ink
 *   Subtitle: 13px 400 #9A9DA1 marginTop 4
 *   Thread: padding 20/20/16, gap 12
 *   User bubble: right-aligned, cobalt, radius 18/18/6/18
 *   Nara bubble: left-aligned, white, radius 16/16/16/5
 *   Typing: left-aligned white bubble, radius 16/16/16/5, three 7px cobalt dots
 *   Chips: inline-flex, margin 0/6/8/0, padding 9/14, white, border interactive
 *   Input: row, padding 12/14/12/18, white, border interactive, radius 999
 *   Footer: padding 10/18/40
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
import { useMutation } from '@tanstack/react-query';
import * as ExpoRouter from 'expo-router';
import { colors, fontFamily } from '@/theme/tokens';

// expo-router re-exports useBottomTabBarHeight at runtime (from
// @react-navigation/bottom-tabs) but doesn't surface its type. Bind it here.
const useBottomTabBarHeight: () => number = (
  ExpoRouter as unknown as { useBottomTabBarHeight: () => number }
).useBottomTabBarHeight;
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

export default function AskScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const flatListRef = useRef<FlatList<Message>>(null);

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
    <View style={styles.container}>
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

        {/* Suggestion chips + input bar area -- bottom padding clears the absolute tab bar */}
        <View style={[styles.footer, { paddingBottom: tabBarHeight + 8 }]}>
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
              placeholder="Ask about anything you've said…"
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
    </View>
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
    paddingTop: 60,
    paddingHorizontal: 24,
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
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },

  // -- Typing indicator ------------------------------------------------------
  typingRow: {
    justifyContent: 'flex-start',
    flexDirection: 'row',
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

  // -- Footer (chips + input) ------------------------------------------------
  footer: {
    flexShrink: 0,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  // -- Suggestion chips ------------------------------------------------------
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
