import { router } from 'expo-router';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useAcceptChallengeMutation, useChallengesQuery, useThreadsQuery } from '@/store/api';
import { useAppSelector } from '@/store';
import { colors } from '@/theme';
import { Body, Button, Screen, styles } from '@/ui';

/** Chats plus incoming challenges waiting for an answer. */
export default function Beefs() {
  const me = useAppSelector((s) => s.auth.userId);
  const threads = useThreadsQuery();
  const challenges = useChallengesQuery();
  const [accept, acceptState] = useAcceptChallengeMutation();
  const incoming = (challenges.data ?? []).filter((c) => c.toUserId === me);

  return (
    <Screen title="Beefs">
      {incoming.map((c) => (
        <View key={c.id} style={[styles.card, { borderColor: colors.red }]}>
          <Body>You’ve been challenged to {c.gameId}.</Body>
          <Button
            label="Settle the score!"
            busy={acceptState.isLoading}
            onPress={async () => {
              const r = await accept(c.id);
              if ('data' in r && r.data) router.push({ pathname: '/game/[sessionId]', params: { sessionId: r.data.id } });
            }}
          />
        </View>
      ))}
      <FlatList
        data={threads.data ?? []}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={<Body muted>No beefs yet. Swipe right on someone in Match to start one.</Body>}
        renderItem={({ item }) => {
          const other = item.members.find((m) => m.userId !== me);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/chat/[threadId]', params: { threadId: item.id } })}
              style={styles.card}
            >
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: '600' }}>{other?.displayName ?? 'Beef'}</Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
