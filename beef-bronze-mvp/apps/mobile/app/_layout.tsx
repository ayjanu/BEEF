import { BebasNeue_400Regular, useFonts } from '@expo-google-fonts/bebas-neue';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider } from 'react-redux';
import { RealtimeProvider } from '@/realtime';
import { hydrateAuth } from '@/store/auth';
import { store, useAppDispatch, useAppSelector } from '@/store';
import { colors } from '@/theme';

function Root() {
  const dispatch = useAppDispatch();
  const hydrated = useAppSelector((s) => s.auth.hydrated);
  const [fontsLoaded] = useFonts({ BebasNeue_400Regular });

  useEffect(() => {
    void dispatch(hydrateAuth());
  }, [dispatch]);

  if (!hydrated || !fontsLoaded) return null;
  return (
    <RealtimeProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="profile-setup" options={{ title: 'Your profile' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[threadId]" options={{ title: 'Beef' }} />
        <Stack.Screen name="game/[sessionId]" options={{ title: 'Game', gestureEnabled: false }} />
        <Stack.Screen name="post/[postId]" options={{ title: 'Beef' }} />
      </Stack>
    </RealtimeProvider>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Provider store={store}>
        <Root />
      </Provider>
    </GestureHandlerRootView>
  );
}
