import { FlatList, Text, View } from 'react-native';
import { useLeaderboardQuery } from '@/store/api';
import { useAppSelector } from '@/store';
import { colors, space } from '@/theme';
import { Body, Screen, styles } from '@/ui';

/**
 * Bronze feed: your latest result and the regional leaderboard. Silver brings
 * the real feed (result cards, rivalries, stories, live) from Spec 01.
 */
export default function Feed() {
  const me = useAppSelector((s) => s.auth.userId);
  const last = useAppSelector((s) => s.realtime.lastResult);
  const board = useLeaderboardQuery('four-up');

  return (
    <Screen title="Feed">
      {last ? (
        <View style={[styles.card, { borderColor: last.outcome === 'win' ? colors.good : colors.border }]}>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>
            {last.outcome === 'win' ? 'You won!' : last.outcome === 'draw' ? 'A draw.' : 'Get your get-back.'}
          </Text>
          <Body muted>
            +{last.xp} XP · +{last.bp} BP · rating {last.rating} ({last.ratingDelta >= 0 ? '+' : ''}
            {last.ratingDelta})
          </Body>
        </View>
      ) : null}
      <Text style={{ color: colors.muted, marginBottom: space(1) }}>FOUR UP · TOP DOGS</Text>
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
    </Screen>
  );
}
