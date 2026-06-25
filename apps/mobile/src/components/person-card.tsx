/**
 * PersonCard Component
 * Used in the People list screen.
 *
 * Design (from Nara.dc.html lines 272-285):
 *   Card: white bg, 1px border rgba(20,22,24,0.07), 16px radius, padding 15px 16px,
 *         flex row, gap 14px, align center
 *   Avatar: 46x46, 13px radius, tinted bg, initial letter 19px weight 600
 *   Name: 17px, weight 600, tracking -0.2, ink (#18191B)
 *   Count: "· X" inline with name, 11.5px, #9A9DA1, gap 8px
 *   Last quote: 13.5px, weight 400, #6A6E73, line-height 1.35, margin-top 3px
 *   Chevron: ">" 19px, #C4C6C9
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { getCategoryColor, fontFamily } from '@/theme/tokens';
import { EntityListItem } from '@nara/shared';

export interface PersonCardProps {
  person: EntityListItem;
  onPress: () => void;
}

export function PersonCard({ person, onPress }: PersonCardProps) {
  const initial = person.name.charAt(0).toUpperCase();
  const avatarBg = getCategoryColor('person', 'tint');
  const avatarColor = getCategoryColor('person', 'base');

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Avatar -- 46px rounded square */}
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={[styles.initial, { color: avatarColor }]}>
          {initial}
        </Text>
      </View>

      {/* Text block */}
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.count}>
            · {person.mention_count}
          </Text>
        </View>
        {person.last_quote != null && person.last_quote.length > 0 && (
          <Text style={styles.quote}>
            {person.last_quote}
          </Text>
        )}
      </View>

      {/* Chevron */}
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(20,22,24,0.07)',
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  initial: {
    fontFamily: fontFamily.grotesk,
    fontSize: 19,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: fontFamily.grotesk,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: '#18191B',
  },
  count: {
    fontFamily: fontFamily.grotesk,
    fontSize: 11.5,
    fontWeight: '400',
    color: '#9A9DA1',
  },
  quote: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13.5,
    fontWeight: '400',
    color: '#6A6E73',
    lineHeight: 13.5 * 1.35,
    marginTop: 3,
  },
  chevron: {
    fontFamily: fontFamily.grotesk,
    fontSize: 19,
    color: '#C4C6C9',
    flexShrink: 0,
  },
});
