import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { getRules } from '@beef/game-rules';
import { config } from '@/config';
import { BOARDS, type SessionView } from '@/games/boards';
import { useAppSelector } from '@/store';
import { errorCode, useRematchMutation } from '@/store/api';
import { colors, fonts, space } from '@/theme';
import { Body, Button, ErrorText, Screen } from '@/ui';

type ServerMsg =
  | { type: 'hello'; seat: number; session: SessionView }
  | { type: 'state'; session: SessionView }
  | { type: 'end'; winnerSeat: number | null; draw: boolean; reason: string; scores?: number[] }
  | { type: 'error'; error: string };

const ERRORS: Record<string, string> = {
  not_your_turn: 'Hold up, it’s their turn.',
  time_expired: 'Too late, the clock ran out.',
  text_blocked: 'That breaks the community rules. Try something else.',
  safety_unavailable: 'Couldn’t check that text just now. Try again in a moment.',
  illegal_move: 'That move isn’t legal.',
  line_taken: 'That line is already drawn.',
  already_answered: 'You already answered this one.',
};

function useCountdown(deadline: number | null): string | null {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (deadline === null) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (deadline === null) return null;
  const s = Math.max(0, Math.ceil((deadline - now) / 1000));
  if (s > 3600) return `${Math.floor(s / 3600)}h left`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Every title against the server-authoritative game engine. The server sends
 * each player their own view (secrets stay hidden) and is always the one
 * shown. For titles whose whole state is public, the shared rules validate
 * taps locally for instant feedback.
 */
export default function Game() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const token = useAppSelector((s) => s.auth.token);
  const ws = useRef<WebSocket | null>(null);
  const [seat, setSeat] = useState<number | null>(null);
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(view?.status === 'active' ? view.deadline : null);
  const [rematch, rematchState] = useRematchMutation();

  useEffect(() => {
    if (!token || !sessionId) return;
    const sock = new WebSocket(`${config.gameWsUrl}/session/${sessionId}?token=${encodeURIComponent(token)}`);
    sock.onmessage = (e) => {
      const m = JSON.parse(String(e.data)) as ServerMsg;
      if (m.type === 'hello') {
        setSeat(m.seat);
        setView(m.session);
      } else if (m.type === 'state') {
        setView(m.session);
        setError(null);
      } else if (m.type === 'error') {
        setError(m.error);
      }
    };
    sock.onerror = () => setError('connection_lost');
    ws.current = sock;
    return () => sock.close();
  }, [token, sessionId]);

  if (!view || seat === null) {
    return (
      <Screen>
        <Body muted>Connecting to the game…</Body>
      </Screen>
    );
  }

  const rules = getRules(view.gameId);
  const Board = BOARDS[view.gameId];
  const end = view.outcome;
  const canAct = !end && view.awaiting.includes(seat);

  function send(move: unknown) {
    if (!rules.view) {
      const err = rules.validate(view!.state, move, seat!, { now: Date.now() });
      if (err) return setError(err);
    }
    ws.current?.send(JSON.stringify({ type: 'move', move }));
  }

  const headline = end
    ? end.winnerSeat === null
      ? end.draw
        ? 'Draw.'
        : 'Good game.'
      : end.winnerSeat === seat
        ? 'You win! Top dog energy.'
        : 'Get your get-back.'
    : canAct
      ? 'Your move'
      : rules.manifest.turnBased
        ? 'Their move'
        : 'Waiting on them';

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: space(1), paddingBottom: space(4) }}>
        <Text style={{ color: colors.muted }}>{rules.manifest.name.toUpperCase()}</Text>
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fonts.display, fontSize: 36, color: colors.text }}>
          {headline}
        </Text>
        {end ? <Body muted>Ended by {end.reason.replace(/_/g, ' ')}.</Body> : countdown ? <Body muted>{countdown}</Body> : null}
        {Board ? <Board view={view} seat={seat} canAct={canAct} send={send} /> : <Body>Update the app to play this game.</Body>}
        {error && !end ? <Body muted>{ERRORS[error] ?? `Move rejected: ${error}`}</Body> : null}
        {end ? (
          <>
            {view.players.length === 2 ? (
              <Button
                label={rematchState.isSuccess ? 'Rematch sent' : 'Run it back'}
                busy={rematchState.isLoading}
                disabled={rematchState.isSuccess}
                onPress={() => void rematch(view.sessionId)}
              />
            ) : null}
            <ErrorText code={errorCode(rematchState.error)} />
            <Button label="Back to Beefs" kind="ghost" onPress={() => router.replace('/beefs')} />
          </>
        ) : (
          <Button label="Resign" kind="ghost" onPress={() => ws.current?.send(JSON.stringify({ type: 'resign' }))} />
        )}
      </ScrollView>
    </Screen>
  );
}
