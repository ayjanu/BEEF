import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { COLS, ROWS, fourUp, type FourUpState } from '@beef/game-rules';
import { config } from '@/config';
import { useAppSelector } from '@/store';
import { colors, fonts, space } from '@/theme';
import { Body, Button, Screen } from '@/ui';

type ServerMsg =
  | { type: 'hello'; seat: number; session: { state: FourUpState } }
  | { type: 'state'; session: { state: FourUpState } }
  | { type: 'end'; winnerSeat: number | null; draw: boolean }
  | { type: 'error'; error: string };

/**
 * Four Up against the server-authoritative game engine. The shared rules
 * package validates taps locally for instant feedback; the server's state is
 * always the one shown. Silver moves rendering to React Native Skia with the
 * drop and win-line animations.
 */
export default function Game() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const token = useAppSelector((s) => s.auth.token);
  const ws = useRef<WebSocket | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [state, setState] = useState<FourUpState | null>(null);
  const [end, setEnd] = useState<{ winnerSeat: number | null; draw: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !sessionId) return;
    const sock = new WebSocket(`${config.gameWsUrl}/session/${sessionId}?token=${encodeURIComponent(token)}`);
    sock.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as ServerMsg;
      if (m.type === 'hello') {
        setSeat(m.seat);
        setState(m.session.state);
      } else if (m.type === 'state') {
        setState(m.session.state);
        setError(null);
      } else if (m.type === 'end') {
        setEnd({ winnerSeat: m.winnerSeat, draw: m.draw });
      } else if (m.type === 'error') {
        setError(m.error);
      }
    };
    sock.onerror = () => setError('connection_lost');
    ws.current = sock;
    return () => sock.close();
  }, [token, sessionId]);

  function drop(column: number) {
    if (!state || seat === null) return;
    const err = fourUp.validate(state, { column }, seat);
    if (err) return setError(err);
    ws.current?.send(JSON.stringify({ type: 'move', move: { column } }));
  }

  const myTurn = state && seat !== null && fourUp.currentSeat(state) === seat;
  const discColor = (v: number) => (v === 0 ? colors.bg : v === seat! + 1 ? colors.red : colors.blue);
  const headline = end
    ? end.draw
      ? 'Draw.'
      : end.winnerSeat === seat
        ? 'You win! Top dog energy.'
        : 'Get your get-back.'
    : myTurn
      ? 'Your move'
      : 'Their move';

  return (
    <Screen>
      <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.display, fontSize: 36, color: colors.text, marginVertical: space(2) }}>
        {headline}
      </Text>
      {state ? (
        <View
          accessibilityLabel="Four Up board"
          style={{ backgroundColor: colors.surface, borderRadius: 16, padding: space(1), gap: space(0.5) }}
        >
          {Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i).map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: space(0.5) }}>
              {Array.from({ length: COLS }, (_, c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Drop in column ${c + 1}`}
                  disabled={!myTurn || !!end}
                  onPress={() => drop(c)}
                  style={{ flex: 1, aspectRatio: 1, borderRadius: 999, backgroundColor: discColor(state.board[r]?.[c] ?? 0), borderWidth: 1, borderColor: colors.border }}
                />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Body muted>Connecting to the game…</Body>
      )}
      {error && !end ? <Body muted>{error === 'not_your_turn' ? 'Hold up, it’s their turn.' : `Move rejected: ${error}`}</Body> : null}
      {end ? (
        <Button label="Back to Beefs" onPress={() => router.replace('/beefs')} />
      ) : (
        <Button label="Resign" kind="ghost" onPress={() => ws.current?.send(JSON.stringify({ type: 'resign' }))} />
      )}
    </Screen>
  );
}
