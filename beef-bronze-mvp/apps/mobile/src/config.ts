import Constants from 'expo-constants';

type Extra = { apiUrl: string; gameWsUrl: string; chatWsUrl: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

/**
 * Endpoints. EXPO_PUBLIC_* variables (set per EAS build profile) override app.json,
 * so one binary config points at local, AWS dev, or prod.
 * On an Android emulator, localhost is the emulator itself: use 10.0.2.2.
 */
export const config: Extra = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:3000',
  gameWsUrl: process.env.EXPO_PUBLIC_GAME_WS_URL ?? extra.gameWsUrl ?? 'ws://localhost:3100',
  chatWsUrl: process.env.EXPO_PUBLIC_CHAT_WS_URL ?? extra.chatWsUrl ?? 'ws://localhost:4000/socket',
};
