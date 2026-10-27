import { Chess } from 'chess.js';
import { useState, type ReactElement } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  BOXES,
  COLS,
  ROWS,
  TQ_CATEGORIES,
  type ChessState,
  type DotsState,
  type FourUpState,
  type TqState,
  type TqCategory,
} from '@beef/game-rules';
import { colors, space } from '@/theme';
import { Body, Button, Field } from '@/ui';

/** What the game engine sends each player: their own view of the match. */
export interface SessionView {
  sessionId: string;
  gameId: string;
  players: string[];
  status: 'active' | 'finished';
  seat: number | null;
  state: any;
  awaiting: number[];
  deadline: number | null;
  moves: number;
  outcome: { winnerSeat: number | null; draw: boolean; scores?: number[]; reason: string } | null;
}

export interface BoardProps {
  view: SessionView;
  seat: number;
  /** Whether this seat may act right now. */
  canAct: boolean;
  send: (move: unknown) => void;
}

/** Your marks are red, theirs blue, on every board. */
const ownerColor = (owner: number, seat: number) => (owner === seat ? colors.red : colors.blue);

function Choice({ label, onPress, selected, disabled }: { label: string; onPress: () => void; selected?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        padding: space(2),
        borderRadius: 12,
        borderWidth: 2,
        borderColor: selected ? colors.red : colors.border,
        backgroundColor: colors.surface,
        opacity: disabled && !selected ? 0.6 : 1,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 18 }}>{label}</Text>
    </Pressable>
  );
}

// ---------- Four Up ----------

function FourUpBoard({ view, seat, canAct, send }: BoardProps) {
  const s = view.state as FourUpState;
  const disc = (v: number) => (v === 0 ? colors.bg : v === seat + 1 ? colors.red : colors.blue);
  return (
    <View accessibilityLabel="Four Up board" style={{ backgroundColor: colors.surface, borderRadius: 16, padding: space(1), gap: space(0.5) }}>
      {Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i).map((r) => (
        <View key={r} style={{ flexDirection: 'row', gap: space(0.5) }}>
          {Array.from({ length: COLS }, (_, c) => (
            <Pressable
              key={c}
              accessibilityRole="button"
              accessibilityLabel={`Drop in column ${c + 1}`}
              disabled={!canAct}
              onPress={() => send({ column: c })}
              style={{ flex: 1, aspectRatio: 1, borderRadius: 999, backgroundColor: disc(s.board[r]?.[c] ?? 0), borderWidth: 1, borderColor: colors.border }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------- Dots and Boxes ----------

function DotsBoard({ view, seat, canAct, send }: BoardProps) {
  const s = view.state as DotsState;
  const cell = 44;
  const dot = 8;
  const line = (taken: boolean) => (taken ? colors.text : colors.border);
  const rows: ReactElement[] = [];
  for (let r = 0; r <= BOXES; r++) {
    // Row of dots and horizontal lines.
    rows.push(
      <View key={`h${r}`} style={{ flexDirection: 'row', alignItems: 'center' }}>
        {Array.from({ length: BOXES }, (_, c) => (
          <View key={c} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: colors.text }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Top edge of row ${r + 1}, column ${c + 1}`}
              disabled={!canAct || s.h[r]![c]}
              onPress={() => send({ o: 'h', r, c })}
              style={{ width: cell, height: 16, justifyContent: 'center' }}
            >
              <View style={{ height: 4, backgroundColor: line(s.h[r]![c]!) }} />
            </Pressable>
          </View>
        ))}
        <View style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: colors.text }} />
      </View>,
    );
    if (r === BOXES) break;
    // Row of vertical lines and boxes.
    rows.push(
      <View key={`v${r}`} style={{ flexDirection: 'row' }}>
        {Array.from({ length: BOXES + 1 }, (_, c) => (
          <View key={c} style={{ flexDirection: 'row' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Left edge of row ${r + 1}, column ${c + 1}`}
              disabled={!canAct || s.v[r]![c]}
              onPress={() => send({ o: 'v', r, c })}
              style={{ width: dot + 8, height: cell, alignItems: 'center', marginHorizontal: -4 }}
            >
              <View style={{ width: 4, height: cell, backgroundColor: line(s.v[r]![c]!) }} />
            </Pressable>
            {c < BOXES ? (
              <View
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: s.owner[r]![c]! >= 0 ? ownerColor(s.owner[r]![c]!, seat) : 'transparent',
                  opacity: 0.6,
                }}
              />
            ) : null}
          </View>
        ))}
      </View>,
    );
  }
  return (
    <View accessibilityLabel="Dots and Boxes board" style={{ alignItems: 'center', gap: 0 }}>
      <Body>
        You {s.scores[seat]} · Them {s.scores[1 - seat]}
      </Body>
      <View style={{ marginTop: space(1) }}>{rows}</View>
    </View>
  );
}

// ---------- Chess ----------

const GLYPH: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const FILES = 'abcdefgh';

function clockText(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

function ChessBoard({ view, seat, canAct, send }: BoardProps) {
  const s = view.state as ChessState;
  const [from, setFrom] = useState<string | null>(null);
  const board = new Chess(s.fen).board();
  const flip = seat === 1; // black at the bottom for seat 1
  const color = seat === 0 ? 'w' : 'b';

  function tap(square: string, piece: { color: string } | null) {
    if (!canAct) return;
    if (from && from !== square) {
      // Auto-queen; under-promotion arrives with the Skia board in Gold.
      const isPromotion = /[18]$/.test(square) && new Chess(s.fen).get(from as never)?.type === 'p';
      send({ from, to: square, ...(isPromotion ? { promotion: 'q' } : {}) });
      setFrom(null);
    } else if (piece?.color === color) {
      setFrom(square);
    } else {
      setFrom(null);
    }
  }

  const ranks = flip ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = flip ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  return (
    <View accessibilityLabel="Chess board">
      <Body muted>Them {clockText(s.clocks[1 - seat]!)}</Body>
      <View style={{ borderRadius: 8, overflow: 'hidden', marginVertical: space(1) }}>
        {ranks.map((rank) => (
          <View key={rank} style={{ flexDirection: 'row' }}>
            {files.map((file) => {
              const square = `${FILES[file]}${rank + 1}`;
              const piece = board[7 - rank]![file] ?? null;
              const light = (rank + file) % 2 === 1;
              return (
                <Pressable
                  key={square}
                  accessibilityRole="button"
                  accessibilityLabel={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
                  onPress={() => tap(square, piece)}
                  style={{
                    flex: 1,
                    aspectRatio: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: from === square ? colors.warn : light ? '#3A4266' : colors.surface,
                  }}
                >
                  {piece ? (
                    <Text style={{ fontSize: 28, color: piece.color === 'w' ? '#FFFFFF' : '#0B0D17', textShadowColor: colors.muted, textShadowRadius: 2 }}>
                      {GLYPH[piece.type]}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Body muted>You {clockText(s.clocks[seat]!)}</Body>
    </View>
  );
}

// ---------- Trivia Burst ----------

function TriviaBoard({ view, seat, canAct, send }: BoardProps) {
  const s = view.state;
  if (!s.question) return <Body>Final: you {s.scores[seat]} · them {s.scores[1 - seat]}</Body>;
  const last = s.history[s.history.length - 1];
  return (
    <View style={{ gap: space(1) }}>
      <Body muted>
        Question {s.round + 1} of {s.rounds} · you {s.scores[seat]} · them {s.scores[1 - seat]}
      </Body>
      {last ? <Body muted>Last answer: {last.points[seat] > 0 ? `+${last.points[seat]}` : 'missed'}</Body> : null}
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>{s.question.q}</Text>
      {s.question.choices.map((c: string, i: number) => (
        <Choice key={i} label={c} selected={s.myPick === i} disabled={!canAct} onPress={() => send({ choice: i })} />
      ))}
    </View>
  );
}

// ---------- Would You Rather ----------

function WyrBoard({ view, canAct, send }: BoardProps) {
  const s = view.state;
  const match = `${s.match.percent}% in sync (${s.match.matched}/${s.match.answered})`;
  if (!s.prompt) return <Body>{match}</Body>;
  return (
    <View style={{ gap: space(1) }}>
      <Body muted>
        {s.round + 1} of {s.rounds} · {match}
      </Body>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Would you rather…</Text>
      <Choice label={s.prompt.a} selected={s.myPick === 'a'} disabled={!canAct} onPress={() => send({ choice: 'a' })} />
      <Choice label={s.prompt.b} selected={s.myPick === 'b'} disabled={!canAct} onPress={() => send({ choice: 'b' })} />
    </View>
  );
}

// ---------- Two Truths & a Lie ----------

function TwoTruthsBoard({ view, seat, canAct, send }: BoardProps) {
  const s = view.state;
  const [lines, setLines] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);
  if (s.phase === 'write') {
    if (!canAct) return <Body>Waiting for them to finish writing…</Body>;
    return (
      <View style={{ gap: space(1) }}>
        <Body>Write two truths and one lie about yourself, then tap the lie.</Body>
        {lines.map((t, i) => (
          <View key={i} style={{ gap: space(0.5) }}>
            <Field label={`Statement ${i + 1}`} value={t} maxLength={140} onChangeText={(v) => setLines(lines.map((x, j) => (j === i ? v : x)))} />
            <Choice label={lie === i ? 'This is the lie' : 'Mark as the lie'} selected={lie === i} onPress={() => setLie(i)} />
          </View>
        ))}
        <Button
          label="Lock it in"
          disabled={lie === null || lines.some((l) => l.trim().length < 3)}
          onPress={() => send({ kind: 'write', statements: lines, lie })}
        />
      </View>
    );
  }
  const theirSet = s.sets[1 - seat];
  return (
    <View style={{ gap: space(1) }}>
      <Body>{s.phase === 'guess' ? 'Which one is the lie?' : `Final: you ${s.scores[seat]} · them ${s.scores[1 - seat]}`}</Body>
      {theirSet?.statements.map((t: string, i: number) => (
        <Choice
          key={i}
          label={s.phase === 'done' && theirSet.lie === i ? `${t}  (the lie)` : t}
          selected={s.myGuess === i}
          disabled={!canAct}
          onPress={() => send({ kind: 'guess', guess: i })}
        />
      ))}
    </View>
  );
}

// ---------- 20 Questions ----------

function TwentyQuestionsBoard({ view, seat, canAct, send }: BoardProps) {
  const s = view.state as TqState & { triesLeft: number };
  const [text, setText] = useState('');
  const [category, setCategory] = useState<TqCategory>('thing');
  const answering = seat === s.answerer;
  const pending = s.qa[s.qa.length - 1];

  return (
    <View style={{ gap: space(1) }}>
      <Body muted>
        {answering ? 'You think of something; they ask.' : 'They’re thinking of something; you ask.'}
        {s.category ? ` It’s a ${s.category}.` : ''} {s.triesLeft} tries left.
      </Body>
      {answering && s.secret ? <Body>Your secret: {s.secret}</Body> : null}
      {s.qa.map((e, i) => (
        <Body key={i} muted={e.reply === null}>
          {i + 1}. {e.kind === 'guess' ? 'Guess: ' : ''}
          {e.text} {e.reply ? `→ ${e.reply}` : ''}
        </Body>
      ))}
      {canAct && s.phase === 'secret' ? (
        <>
          <Field label="Your secret (a person, place, thing or animal)" value={text} maxLength={40} onChangeText={setText} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
            {TQ_CATEGORIES.map((c) => (
              <Choice key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          <Button label="Lock it in" disabled={!text.trim()} onPress={() => (send({ kind: 'secret', secret: text, category }), setText(''))} />
        </>
      ) : null}
      {canAct && s.phase === 'ask' ? (
        <>
          <Field label="Ask a yes/no question, or guess" value={text} maxLength={140} onChangeText={setText} />
          <View style={{ flexDirection: 'row', gap: space(1) }}>
            <Button label="Ask" disabled={text.trim().length < 3} onPress={() => (send({ kind: 'question', text }), setText(''))} />
            <Button label="Guess" kind="ghost" disabled={!text.trim()} onPress={() => (send({ kind: 'guess', text }), setText(''))} />
          </View>
        </>
      ) : null}
      {canAct && s.phase === 'answer' && pending ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(1) }}>
          {(pending.kind === 'guess' ? ['yes', 'no'] : ['yes', 'no', 'sometimes', 'unknown']).map((r) => (
            <Choice key={r} label={r} onPress={() => send({ kind: 'reply', reply: r })} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const BOARDS: Record<string, (p: BoardProps) => ReactElement> = {
  'four-up': FourUpBoard,
  'dots-and-boxes': DotsBoard,
  chess: ChessBoard,
  'chess-bullet': ChessBoard,
  'trivia-burst': TriviaBoard,
  'would-you-rather': WyrBoard,
  'two-truths': TwoTruthsBoard,
  'twenty-questions': TwentyQuestionsBoard,
};
