/**
 * ChatBubble Component
 * Used in Ask Nara screen for both user and Nara messages.
 *
 * Design (from Nara.dc.html lines 237-240):
 *   User:  cobalt bg (#2E50E6), white text, radius 16/16/5/16, padding 13px 16px
 *   Nara:  white bg, 1px border rgba(20,22,24,0.07), ink text, radius 16/16/16/5, padding 13px 16px
 *   Both:  14.5px, weight 500, line-height 1.45
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme/tokens';

export interface ChatBubbleProps {
  message: string;
  variant: 'user' | 'nara';
}

export function ChatBubble({ message, variant }: ChatBubbleProps) {
  return (
    <View
      style={[
        styles.container,
        variant === 'user' ? styles.userContainer : styles.naraContainer,
      ]}
    >
      <View
        style={[
          styles.bubble,
          variant === 'user' ? styles.userBubble : styles.naraBubble,
        ]}
      >
        <Text
          style={[
            styles.text,
            variant === 'user' ? styles.userText : styles.naraText,
          ]}
        >
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    paddingHorizontal: 20,
  },
  userContainer: {
    alignItems: 'flex-end',
  },
  naraContainer: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '78%',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  userBubble: {
    backgroundColor: '#2E50E6',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 5,
    borderBottomLeftRadius: 16,
  },
  naraBubble: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
  },
  text: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 14.5 * 1.45,
  },
  userText: {
    color: '#FFFFFF',
  },
  naraText: {
    color: '#18191B',
  },
});
