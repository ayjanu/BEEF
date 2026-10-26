import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useMeQuery } from '@/store/api';
import { useAppSelector } from '@/store';
import { colors } from '@/theme';

/** Routes a launch to sign-in, profile setup, or the app, based on server state. */
export default function Index() {
  const token = useAppSelector((s) => s.auth.token);
  const me = useMeQuery(undefined, { skip: !token });

  if (!token) return <Redirect href="/sign-in" />;
  if (me.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.red} />
      </View>
    );
  }
  if (me.isError || !me.data) return <Redirect href="/profile-setup" />;
  return <Redirect href="/match" />;
}
