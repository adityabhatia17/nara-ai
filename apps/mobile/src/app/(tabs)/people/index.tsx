/**
 * People Screen -- People tab
 * Displays a paginated list of everyone mentioned in notes.
 *
 * Design (from Nara.dc.html lines 264-289):
 *   Title: "People" -- 32px, weight 700, tracking -0.8, #18191B
 *   Subtitle: "The people you mention, remembered over time." -- 13px, weight 400, #9A9DA1
 *   Cards: PersonCard components, gap 10px
 */

import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { colors, spacing, fontFamily } from '@/theme/tokens';
import { api } from '@/lib/api';
import { EntityListItem, EntitiesListResponse } from '@nara/shared';
import { ScreenTitle } from '@/components/screen-title';
import { PersonCard } from '@/components/person-card';
import { PersonCardSkeleton } from '@/components/PersonCardSkeleton';

export default function PeopleScreen() {
  const router = useRouter();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['entities', 'person'],
    queryFn: async ({ pageParam = undefined }) => {
      const response = await api.get<EntitiesListResponse>('/entities', {
        params: {
          type: 'person',
          limit: 20,
          ...(pageParam != null && { cursor: pageParam }),
        },
      });
      return response.data;
    },
    getNextPageParam: (lastPage: any) => lastPage.next_cursor ?? undefined,
    initialPageParam: undefined,
  });

  const allPeople = data?.pages.flatMap((page) => page.entities) ?? [];

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handlePersonPress = (personId: string) => {
    router.push(`/people/${personId}`);
  };

  // -- Render helpers --------------------------------------------------------

  const renderPersonItem = ({ item }: { item: EntityListItem }) => (
    <PersonCard
      person={item}
      onPress={() => handlePersonPress(item.id)}
    />
  );

  const renderFooter = () => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  };

  // -- Empty / loading / error states ----------------------------------------

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.header}>
          <ScreenTitle
            title="People"
            subtitle="The people you mention, remembered over time."
          />
        </View>
        <View style={styles.skeletonContainer}>
          <PersonCardSkeleton />
          <PersonCardSkeleton />
          <PersonCardSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={styles.header}>
          <ScreenTitle
            title="People"
            subtitle="The people you mention, remembered over time."
          />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>
            Couldn't load people. Please try again.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // -- Layout ----------------------------------------------------------------

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <View style={styles.header}>
        <ScreenTitle
          title="People"
          subtitle="The people you mention, remembered over time."
        />
      </View>

      {allPeople.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>
            You haven't mentioned anyone yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={allPeople}
          renderItem={renderPersonItem}
          keyExtractor={(item) => item.id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

// -- Styles ------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 8,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: spacing.tabBar,
    gap: 10,
    paddingTop: 18,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skeletonContainer: {
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 10,
  },
  emptyText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    color: '#4D5560',
    textAlign: 'center',
  },
  errorText: {
    fontFamily: fontFamily.grotesk,
    fontSize: 15,
    fontWeight: '500',
    color: '#DC2626',
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
