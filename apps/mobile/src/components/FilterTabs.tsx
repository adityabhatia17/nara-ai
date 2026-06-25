/**
 * FilterTabs Component
 * Three filter pills: Time, Category, People
 *
 * Design (from Nara.dc.html lines 173-177):
 *   Container: flex row, gap 7px
 *   Active:  white bg, 1px border rgba(20,22,24,0.1), radius 999, padding 7px 15px,
 *            13px font, weight 600, color #18191B
 *   Inactive: no bg, no border, same padding, 13px, weight 600, color #9A9DA1
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, fontFamily } from '@/theme/tokens';

type FilterType = 'time' | 'category' | 'person';

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
}

export default function FilterTabs({ activeFilter, onFilterChange }: FilterTabsProps) {
  const filters: { label: string; value: FilterType }[] = [
    { label: 'Time', value: 'time' },
    { label: 'Category', value: 'category' },
    { label: 'People', value: 'person' },
  ];

  return (
    <View style={styles.container}>
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter.value}
          style={[
            styles.pill,
            activeFilter === filter.value ? styles.pillActive : styles.pillInactive,
          ]}
          onPress={() => onFilterChange(filter.value)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.pillText,
              activeFilter === filter.value ? styles.textActive : styles.textInactive,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 15,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(20,22,24,0.1)',
  },
  pillInactive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  pillText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 13,
    fontWeight: '600',
  },
  textActive: {
    color: '#18191B',
  },
  textInactive: {
    color: '#9A9DA1',
  },
});
