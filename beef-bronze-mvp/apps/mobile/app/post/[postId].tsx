import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { FeedCard } from '@/feed-card';
import { errorCode, useAddCommentMutation, useCommentsQuery, useFeedQuery } from '@/store/api';
import { useAppSelector } from '@/store';
import { colors, space } from '@/theme';
import { Button, ErrorText, styles } from '@/ui';

/** One result card and its comments. Comments are screened; borderline ones sit behind a tap-to-reveal. */
export default function Post() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const me = useAppSelector((s) => s.auth.userId);
  const post = useFeedQuery(null, {
    selectFromResult: (r) => ({ post: r.data?.posts.find((p) => p.id === postId) }),
  }).post;
  const comments = useCommentsQuery(postId);
  const [add, addState] = useAddCommentMutation();
  const [draft, setDraft] = useState('');
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        style={{ flex: 1, paddingHorizontal: space(2) }}
        ListHeaderComponent={post ? <FeedCard post={post} me={me} linkToPost={false} /> : undefined}
        data={comments.data ?? []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => {
          const hidden = item.action === 'blur' && item.userId !== me && !revealed[item.id];
          return (
            <Pressable
              disabled={!hidden}
              onPress={() => setRevealed({ ...revealed, [item.id]: true })}
              style={[styles.card, { paddingVertical: space(1) }]}
            >
              <Text style={{ color: colors.muted, fontSize: 13 }}>{item.displayName}</Text>
              <Text style={{ color: colors.text, fontSize: 16 }}>{hidden ? 'This comment may be offensive. Tap to show.' : item.body}</Text>
            </Pressable>
          );
        }}
      />
      <View style={{ padding: space(2), gap: space(1) }}>
        <ErrorText code={errorCode(addState.error)} />
        <TextInput
          value={draft}
          onChangeText={setDraft}
          maxLength={500}
          placeholder="Talk your talk…"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Button
          label="Comment"
          busy={addState.isLoading}
          disabled={!draft.trim()}
          onPress={async () => {
            const r = await add({ postId, body: draft });
            if ('data' in r) setDraft('');
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
