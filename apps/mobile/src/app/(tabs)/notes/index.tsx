/**
 * Feed Screen — Notes tab
 * "Your notes" grouped by Time / Category / Person with infinite scroll.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  ListRenderItemInfo,
} from 'react-native';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useAppStore } from '@/store/app';
import { api } from '@/lib/api';
import { formatSectionDate } from '@/lib/format';
import { colors, fontFamily } from '@/theme/tokens';
import FilterTabs from '@/components/FilterTabs';
import { NoteCard } from '@/components/note-card';
import SectionHeader from '@/components/SectionHeader';
import { NoteCardSkeleton } from '@/components/NoteCardSkeleton';
import type { Note, NotesListResponse } from '@nara/shared';

type GroupView = 'time' | 'category' | 'person';

interface FeedItem {
  type: 'section' | 'note';
  id: string;
  title?: string;
  note?: Note;
}

export default function FeedScreen() {
  const router = useRouter();
  const { feedFilters, setFeedFilters } = useAppStore();
  const activeFilter: GroupView = feedFilters.view;

  // Infinite query — cursor-based pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
  } = useInfiniteQuery({
    queryKey: ['notes', feedFilters],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, unknown> = {
        limit: 20,
        group: activeFilter,
      };
      if (pageParam) params.cursor = pageParam;
      const response = await api.get<NotesListResponse>('/notes', { params });
      return response.data;
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  // Flatten all pages into one list, then group into sections locally
  const feedItems = useMemo((): FeedItem[] => {
    if (!data) return [];

    const allNotes = data.pages.flatMap((page) => page.notes);

    const groups = groupNotes(allNotes, activeFilter);
    const items: FeedItem[] = [];

    groups.forEach(({ key, notes }) => {
      items.push({ type: 'section', id: `section:${key}`, title: key });
      notes.forEach((note) => items.push({ type: 'note', id: note.id, note }));
    });

    return items;
  }, [data, activeFilter]);

  const handleFilterChange = (filter: GroupView) => {
    setFeedFilters({ view: filter });
  };

  const renderItem = ({ item, index }: ListRenderItemInfo<FeedItem>) => {
    if (item.type === 'section') {
      return <SectionHeader title={item.title ?? ''} />;
    }
    // Gap 10 between consecutive NoteCards
    const nextItem = feedItems[index + 1];
    const needsGap = nextItem && nextItem.type === 'note';
    return (
      <View style={styles.cardWrapper}>
        <NoteCard
          note={item.note!}
          onPress={() => router.push(`/(tabs)/notes/${item.note!.id}`)}
          style={needsGap ? { marginBottom: 10 } : undefined}
        />
      </View>
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Your notes</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load notes</Text>
          <Text style={styles.errorSub}>{(error as Error).message}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={feedItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Your notes</Text>
            <FilterTabs
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />
          </View>
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Nothing here yet. Tap Talk to add your first note.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.skeletonContainer}>
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
          <NoteCardSkeleton />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

interface SectionGroup {
  key: string;
  /** Preserved insertion order for Time; alphabetical for Category/Person */
  notes: Note[];
}

function groupNotes(notes: Note[], view: GroupView): SectionGroup[] {
  const map = new Map<string, Note[]>();

  for (const note of notes) {
    const key = getSectionKey(note, view);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(note);
  }

  if (view === 'time') {
    // Preserve natural order (notes are already newest-first from API)
    return Array.from(map.entries()).map(([key, notes]) => ({ key, notes }));
  }

  // Category / Person: alphabetical, but "Uncategorized" / "Other" last
  const entries = Array.from(map.entries()).sort(([a], [b]) => {
    const tail = view === 'category' ? 'Uncategorized' : 'Other';
    if (a === tail) return 1;
    if (b === tail) return -1;
    return a.localeCompare(b);
  });

  return entries.map(([key, notes]) => ({ key, notes }));
}

function getSectionKey(note: Note, view: GroupView): string {
  if (view === 'time') {
    return formatSectionDate(note.created_at);
  }
  if (view === 'category') {
    return note.categories.length > 0 ? note.categories[0].name : 'Uncategorized';
  }
  // person
  const personEntity = note.entities.find((e) => e.entity_type === 'person');
  return personEntity ? personEntity.name : 'Other';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  /* Header block: paddingTop 60, horizontal 24, bottom 4 */
  headerBlock: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  title: {
    fontFamily: fontFamily.grotesk,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    color: '#18191B',
    marginBottom: 16,
  },
  /* Scroll body: bottom 122. Horizontal padding is on individual items. */
  listContent: {
    paddingBottom: 122,
  },
  cardWrapper: {
    paddingHorizontal: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 8,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
    fontFamily: fontFamily.grotesk,
  },
  errorSub: {
    fontSize: 11.5,
    color: colors.faint,
    fontFamily: fontFamily.grotesk,
  },
  empty: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.faint,
    textAlign: 'center',
    lineHeight: 15 * 1.45,
    fontFamily: fontFamily.grotesk,
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  skeletonContainer: {
    ...(StyleSheet.absoluteFill as object),
    paddingHorizontal: 24,
    paddingTop: 140,
    gap: 10,
    backgroundColor: colors.paper,
  },
});
