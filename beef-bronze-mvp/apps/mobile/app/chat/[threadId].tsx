import { useLocalSearchParams } from 'expo-router';
import type { Channel } from 'phoenix';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useSocket } from '@/realtime';
import { errorCode, useChallengeMutation, useThreadsQuery } from '@/store/api';
import { useAppSelector } from '@/store';
import { colors, space } from '@/theme';
import { Body, Button, ErrorText, styles } from '@/ui';

interface Msg {
  id: string;
  sender_id: string;
  body: string;
  action: 'allow' | 'blur';
  labels: string[];
  sent_at: string;
}

/** One chat thread over the shared Phoenix socket. Blurred messages sit behind a tap-to-reveal. */
export default function Chat() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const socket = useSocket();
  const me = useAppSelector((s) => s.auth.userId);
  const threads = useThreadsQuery();
  const other = threads.data?.find((t) => t.id === threadId)?.members.find((m) => m.userId !== me);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const channel = useRef<Channel | null>(null);
  const [challenge, challengeState] = useChallengeMutation();

  useEffect(() => {
    if (!socket || !threadId) return;
    const ch = socket.channel(`thread:${threadId}`);
    ch.on('msg', (m: Msg) => setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m])));
    ch.join().receive('ok', (resp: { messages: Msg[] }) => setMessages(resp.messages));
    channel.current = ch;
    return () => {
      ch.leave();
      channel.current = null;
    };
  }, [socket, threadId]);

  function send() {
    const body = draft.trim();
    if (!body || !channel.current) return;
    channel.current
      .push('msg', { body })
      .receive('ok', () => {
        setDraft('');
        setNotice(null);
      })
      .receive('error', (e: { error: string }) =>
        setNotice(e.error === 'blocked' ? 'That message breaks the community rules and was not sent.' : 'Could not send. Try again.'),
      );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {other ? (
        <View style={{ paddingHorizontal: space(2) }}>
          <Button
            label={`Challenge ${other.displayName} to Four Up`}
            busy={challengeState.isLoading}
            onPress={() => void challenge({ toUserId: other.userId, gameId: 'four-up' })}
          />
          {challengeState.isSuccess ? <Body muted>Challenge sent. Squash that beef!</Body> : null}
          <ErrorText code={errorCode(challengeState.error)} />
        </View>
      ) : null}
      <FlatList
        style={{ flex: 1, paddingHorizontal: space(2) }}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          const hidden = item.action === 'blur' && !mine && !revealed[item.id];
          return (
            <Pressable
              disabled={!hidden}
              accessibilityHint={hidden ? 'This message may contain personal details. Tap to show.' : undefined}
              onPress={() => setRevealed((r) => ({ ...r, [item.id]: true }))}
              style={[
                styles.card,
                { alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '80%', backgroundColor: mine ? colors.red : colors.surface },
              ]}
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>{hidden ? 'Does this bother you? Tap to show.' : item.body}</Text>
            </Pressable>
          );
        }}
      />
      {notice ? <Text style={[styles.error, { paddingHorizontal: space(2) }]}>{notice}</Text> : null}
      <View style={{ flexDirection: 'row', padding: space(1), gap: space(1), borderTopWidth: 1, borderColor: colors.border }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Talk your talk…"
          placeholderTextColor={colors.muted}
          maxLength={2000}
          style={[styles.input, { flex: 1 }]}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} style={[styles.button, { marginVertical: 0 }]}>
          <Text style={styles.buttonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
