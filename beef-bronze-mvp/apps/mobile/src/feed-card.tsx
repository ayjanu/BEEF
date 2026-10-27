import type { FeedPost, ReactionKind } from '@beef/contracts';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useReactMutation, useRematchMutation } from '@/store/api';
import { colors, space } from '@/theme';
import { Body, styles } from '@/ui';

export const REACTIONS: Array<[ReactionKind, string]> = [
  ['fire', '🔥'],
  ['beef', '🥩'],
  ['skull', '💀'],
  ['laugh', '😂'],
  ['clap', '👏'],
];

const REASONS: Record<string, string> = {
  checkmate: 'by checkmate',
  timeout: 'on time',
  resign: 'by resignation',
  resignation: 'by resignation',
  guessed: 'guessing it',
  guess_accepted: 'guessing it',
  stumped: 'with a stumper',
  opponent_did_not_write: 'by no-show',
};

/** "Ayan beat Sam at Chess by checkmate", with scores, rating moves and reactions. */
export function headline(p: FeedPost): string {
  const [a, b] = p.players;
  const names = p.players.map((x) => x.displayName);
  if (p.winnerSeat === null) {
    return p.draw ? `${names.join(' and ')} drew at ${p.gameName}` : `${names.join(' and ')} played ${p.gameName}`;
  }
  const winner = p.players[p.winnerSeat]!;
  const loser = p.players.find((x) => x.userId !== winner.userId) ?? (winner === a ? b : a);
  return `${winner.displayName} beat ${loser?.displayName ?? 'their opponent'} at ${p.gameName} ${REASONS[p.reason] ?? ''}`.trim();
}

export function FeedCard({ post, me, linkToPost = true }: { post: FeedPost; me: string | null; linkToPost?: boolean }) {
  const [react] = useReactMutation();
  const [rematch, rematchState] = useRematchMutation();
  const mine = post.players.some((p) => p.userId === me);
  const won = post.winnerSeat !== null && post.players[post.winnerSeat]?.userId === me;

  return (
    <View style={[styles.card, won && { borderColor: colors.good }]}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        {post.gameName.toUpperCase()} · {post.rated ? 'RANKED' : 'FOR FUN'}
      </Text>
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: '700', marginVertical: space(0.5) }}>{headline(post)}</Text>
      {post.scores ? <Body muted>Score {post.scores.join(' – ')}</Body> : null}
      {post.rated ? (
        <Body muted>
          {post.players
            .map((p) => `${p.displayName} ${p.ratingDelta !== null && p.ratingDelta >= 0 ? '+' : ''}${p.ratingDelta ?? 0}`)
            .join(' · ')}
        </Body>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space(1), marginTop: space(1), flexWrap: 'wrap' }}>
        {REACTIONS.map(([kind, emoji]) => {
          const selected = post.myReaction === kind;
          return (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={`React ${kind}`}
              accessibilityState={{ selected }}
              onPress={() => void react({ postId: post.id, kind: selected ? null : kind })}
              style={{
                paddingHorizontal: space(1),
                paddingVertical: space(0.5),
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? colors.red : colors.border,
              }}
            >
              <Text style={{ color: colors.text }}>
                {emoji} {post.reactions[kind] ?? 0}
              </Text>
            </Pressable>
          );
        })}
        {linkToPost ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/post/[postId]', params: { postId: post.id } })}
            style={{ paddingHorizontal: space(1), paddingVertical: space(0.5) }}
          >
            <Text style={{ color: colors.muted }}>💬 {post.commentCount}</Text>
          </Pressable>
        ) : null}
        {mine ? (
          <Pressable
            accessibilityRole="button"
            disabled={rematchState.isLoading || rematchState.isSuccess}
            onPress={() => void rematch(post.sessionId)}
            style={{ paddingHorizontal: space(1), paddingVertical: space(0.5) }}
          >
            <Text style={{ color: colors.red, fontWeight: '700' }}>{rematchState.isSuccess ? 'Rematch sent' : 'Run it back'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
