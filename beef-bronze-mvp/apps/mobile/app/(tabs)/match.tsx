import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import type { Profile } from '@beef/contracts';
import { errorCode, useDeckQuery, useSwipeMutation } from '@/store/api';
import { colors, space } from '@/theme';
import { Body, Button, ErrorText, Screen, styles } from '@/ui';

const intentColor = (p: Profile) =>
  p.intents.length > 1 ? colors.lilac : p.intents[0] === 'romantic' ? colors.pink : colors.blue;

/**
 * Swipe-to-challenge deck. Bronze uses buttons; Silver adds the drag gesture,
 * the custom challenge builder, and the Incoming list (Spec 01 "Match").
 */
export default function Match() {
  const deck = useDeckQuery();
  const [swipe, swipeState] = useSwipeMutation();
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const card = deck.data?.[index];

  async function act(direction: 'left' | 'right') {
    if (!card) return;
    const r = await swipe({ targetId: card.userId, direction });
    setIndex((i) => i + 1);
    if ('data' in r && r.data?.matched && r.data.threadId) {
      setToast(`It's on with ${card.displayName}!`);
      router.push({ pathname: '/chat/[threadId]', params: { threadId: r.data.threadId } });
    }
  }

  return (
    <Screen title="Match">
      {deck.isLoading ? <Body muted>Finding challengers near you…</Body> : null}
      <ErrorText code={errorCode(deck.error) ?? errorCode(swipeState.error)} />
      {card ? (
        <View style={[styles.card, { borderColor: intentColor(card), borderWidth: 2, minHeight: 320 }]}>
          <Text style={{ color: colors.text, fontSize: 32, fontWeight: '700' }}>
            {card.displayName}, {card.age}
          </Text>
          <Text style={{ color: colors.muted, marginVertical: space(1) }}>
            {card.intents.join(' + ')} · {card.tier}
          </Text>
          {card.bio ? <Body>{card.bio}</Body> : null}
          <Body muted>Plays: {card.games.join(', ') || 'anything'}</Body>
        </View>
      ) : deck.isSuccess ? (
        <Body muted>No one new nearby right now. Check back soon, or hit Play for a quick match.</Body>
      ) : null}
      {card ? (
        <View style={{ flexDirection: 'row', gap: space(2) }}>
          <View style={{ flex: 1 }}>
            <Button label="Skip" kind="ghost" onPress={() => act('left')} busy={swipeState.isLoading} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Challenge" onPress={() => act('right')} busy={swipeState.isLoading} />
          </View>
        </View>
      ) : null}
      {toast ? <Body>{toast}</Body> : null}
    </Screen>
  );
}
