import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { errorCode, useGamesQuery, useJoinQueueMutation, useLeaveQueueMutation } from '@/store/api';
import { matchConsumed, useAppDispatch, useAppSelector } from '@/store';
import { colors, space } from '@/theme';
import { Body, Button, ErrorText, Screen, styles } from '@/ui';

const LEVEL_NAMES = { 1: 'Shade', 2: 'Now It’s Personal', 3: 'Prove It!', 4: 'BEEF!' } as const;

/** Game browser + skill queue. A match_found push opens the game screen. */
export default function Play() {
  const dispatch = useAppDispatch();
  const games = useGamesQuery();
  const pending = useAppSelector((s) => s.realtime.pendingMatch);
  const [queuedFor, setQueuedFor] = useState<string | null>(null);
  const [join, joinState] = useJoinQueueMutation();
  const [leave] = useLeaveQueueMutation();

  useEffect(() => {
    if (!pending) return;
    setQueuedFor(null);
    dispatch(matchConsumed());
    router.push({ pathname: '/game/[sessionId]', params: { sessionId: pending.id } });
  }, [pending, dispatch]);

  return (
    <Screen title="Play">
      <ErrorText code={errorCode(games.error) ?? errorCode(joinState.error)} />
      <FlatList
        data={games.data ?? []}
        keyExtractor={(g) => g.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={{ color: colors.red, fontSize: 13 }}>
              LEVEL {item.level} · {LEVEL_NAMES[item.level].toUpperCase()}
            </Text>
            <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', marginVertical: space(0.5) }}>{item.name}</Text>
            <Body muted>{item.formats.join(', ')} · {item.turnBased ? 'turn-based' : 'real-time'}</Body>
            {queuedFor === item.id ? (
              <Button
                label="Cancel search"
                kind="ghost"
                onPress={async () => {
                  await leave(item.id);
                  setQueuedFor(null);
                }}
              />
            ) : (
              <Button
                label="Quick match"
                busy={joinState.isLoading}
                disabled={!!queuedFor}
                onPress={async () => {
                  const r = await join({ gameId: item.id });
                  if ('data' in r) setQueuedFor(item.id);
                }}
              />
            )}
            {queuedFor === item.id ? <Body muted>Now matching you with someone your level…</Body> : null}
          </View>
        )}
        ListFooterComponent={<Body muted>More titles arrive in Silver: 20 across all four levels (Spec 02).</Body>}
      />
    </Screen>
  );
}
