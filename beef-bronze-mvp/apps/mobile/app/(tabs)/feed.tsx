import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { errorCode, useFeedQuery, useGamesQuery, useLeaderboardQuery } from '@/store/api';
import { useAppSelector } from '@/store';
import { FeedCard } from '@/feed-card';
import { colors, space } from '@/theme';
import { Body, ErrorText, Screen, styles } from '@/ui';

/**
 * Silver feed: result cards from your games and the people you follow, with
 * reactions, comments and rematches; plus per-game leaderboards. Clips and
 * stories arrive with the media pipeline in Gold.
 */
export default function Feed() {
  const me = useAppSelector((s) => s.auth.userId);
  const [tab, setTab] = useState<'feed' | 'top'>('feed');
  const [cursor, setCursor] = useState<string | null>(null);
  const feed = useFeedQuery(cursor);

  return (
    <Screen title="Feed">
      <View style={{ flexDirection: 'row', gap: space(2), marginBottom: space(1) }}>
        {(['feed', 'top'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)}>
            <Text style={{ color: tab === t ? colors.text : colors.muted, fontSize: 18, fontWeight: '700' }}>
              {t === 'feed' ? 'Following' : 'Top dogs'}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === 'feed' ? (
        <>
          <ErrorText code={errorCode(feed.error)} />
          <FlatList
            data={feed.data?.posts ?? []}
            keyExtractor={(p) => p.id}
            renderItem={({ item }) => <FeedCard post={item} me={me} />}
            refreshControl={
              <RefreshControl
                refreshing={feed.isFetching && cursor === null}
                onRefresh={() => (cursor === null ? void feed.refetch() : setCursor(null))}
              />
            }
            onEndReached={() => feed.data?.next && !feed.isFetching && setCursor(feed.data.next)}
            ListEmptyComponent={
              feed.isLoading ? undefined : <Body muted>Play a game or follow someone and their results show up here.</Body>
            }
          />
        </>
      ) : (
        <Leaderboards me={me} />
      )}
    </Screen>
  );
}

function Leaderboards({ me }: { me: string | null }) {
  const games = useGamesQuery();
  const ranked = (games.data ?? []).filter((g) => g.rated);
  const [gameId, setGameId] = useState('four-up');
  const board = useLeaderboardQuery(gameId);
  return (
    <>
      <FlatList
        horizontal
        style={{ flexGrow: 0, marginBottom: space(1) }}
        data={ranked}
        keyExtractor={(g) => g.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space(1) }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === gameId }}
            onPress={() => setGameId(item.id)}
            style={{
              paddingHorizontal: space(1.5),
              paddingVertical: space(0.75),
              borderRadius: 999,
              borderWidth: 1,
              borderColor: item.id === gameId ? colors.red : colors.border,
            }}
          >
            <Text style={{ color: colors.text }}>{item.name}</Text>
          </Pressable>
        )}
      />
      <FlatList
        data={board.data ?? []}
        keyExtractor={(e) => e.userId}
        ListEmptyComponent={<Body muted>No ranked games yet. Be the first.</Body>}
        renderItem={({ item }) => (
          <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-between' }, item.userId === me && { borderColor: colors.red }]}>
            <Text style={{ color: colors.text, fontSize: 17 }}>
              #{item.rank} {item.displayName}
            </Text>
            <Text style={{ color: colors.text, fontSize: 17, fontVariant: ['tabular-nums'] }}>{item.rating}</Text>
          </View>
        )}
      />
    </>
  );
}
