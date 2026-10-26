import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/theme';

/** The five tabs from Spec 01 "Navigation": Feed, Play, Match (center), Beefs, Profile. */
const icon = (glyph: string) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{glyph}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: icon('😎') }} />
      <Tabs.Screen name="play" options={{ title: 'Play', tabBarIcon: icon('🎮') }} />
      <Tabs.Screen name="match" options={{ title: 'Match', tabBarIcon: icon('🥊') }} />
      <Tabs.Screen name="beefs" options={{ title: 'Beefs', tabBarIcon: icon('💬') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('👤') }} />
    </Tabs>
  );
}
