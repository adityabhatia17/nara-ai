/**
 * ChatBubble Component
 * Used in Ask Nara screen for both user and Nara messages.
 *
 * Design (pixel-matched to Nara.dc.html ASK NARA block):
 *   User:  cobalt bg (#2E50E6), white text, radius 18/18/6/18, padding 12/15,
 *          maxWidth 78%, fontSize 14.5, lineHeight 14.5*1.45
 *   Nara:  white bg, 1px border rgba(20,22,24,0.07), body text (#26282B),
 *          radius 16/16/16/5, padding 13/16, maxWidth 84%, fontSize 15, lineHeight 15*1.5
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontFamily } from '@/theme/tokens';

export interface ChatBubbleProps {
  message: string;
  variant: 'user' | 'nara';
}

export function ChatBubble({ message, variant }: ChatBubbleProps) {
  const isUser = variant === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowNara]}>
      <View style={[isUser ? styles.userBubble : styles.naraBubble]}>
        <Text style={[isUser ? styles.userText : styles.naraText]}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowNara: {
    justifyContent: 'flex-start',
  },
  userBubble: {
    maxWidth: '78%',
    backgroundColor: '#2E50E6',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  naraBubble: {
    maxWidth: '84%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  userText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 14.5,
    fontWeight: '400',
    lineHeight: 14.5 * 1.45,
    color: '#FFFFFF',
  },
  naraText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 15 * 1.5,
    color: '#26282B',
  },
});
