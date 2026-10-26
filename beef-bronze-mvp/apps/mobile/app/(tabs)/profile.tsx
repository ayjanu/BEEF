import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { api, useMeQuery, useWalletQuery } from '@/store/api';
import { signOut } from '@/store/auth';
import { useAppDispatch } from '@/store';
import { colors, space } from '@/theme';
import { Body, Button, Screen, styles } from '@/ui';

export default function ProfileTab() {
  const dispatch = useAppDispatch();
  const me = useMeQuery();
  const wallet = useWalletQuery();

  return (
    <Screen title={me.data?.displayName ?? 'Profile'}>
      <View style={[styles.card, { flexDirection: 'row', justifyContent: 'space-around' }]}>
        {[
          ['LEVEL', wallet.data?.level ?? 1],
          ['XP', wallet.data?.xp ?? 0],
          ['BEEF POINTS', wallet.data?.bp ?? 0],
        ].map(([label, value]) => (
          <View key={String(label)} style={{ alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: '700' }}>{value}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
          </View>
        ))}
      </View>
      {(wallet.data?.ratings ?? []).map((r) => (
        <View key={r.gameId} style={styles.card}>
          <Body>
            {r.gameId}: {r.rating} (±{r.rd}) · {r.games} games
          </Body>
        </View>
      ))}
      <Body muted>Verification: {me.data?.tier ?? 'V0'}</Body>
      <View style={{ height: space(3) }} />
      <Button
        label="Sign out"
        kind="ghost"
        onPress={async () => {
          await dispatch(signOut());
          dispatch(api.util.resetApiState());
          router.replace('/sign-in');
        }}
      />
    </Screen>
  );
}
