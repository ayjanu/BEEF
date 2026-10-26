import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { GameResultEvent, Session } from '@beef/contracts';
import { api } from './api';
import auth from './auth';

/** Realtime events pushed on the user's channel (chat service). */
interface RealtimeState {
  pendingMatch: Session | null;
  lastResult: GameResultEvent | null;
}

const realtime = createSlice({
  name: 'realtime',
  initialState: { pendingMatch: null, lastResult: null } as RealtimeState,
  reducers: {
    matchFound(s, a: PayloadAction<Session>) {
      s.pendingMatch = a.payload;
    },
    matchConsumed(s) {
      s.pendingMatch = null;
    },
    gameResult(s, a: PayloadAction<GameResultEvent>) {
      s.lastResult = a.payload;
    },
  },
});

export const { matchFound, matchConsumed, gameResult } = realtime.actions;

export const store = configureStore({
  reducer: { auth, realtime: realtime.reducer, [api.reducerPath]: api.reducer },
  middleware: (gdm) => gdm().concat(api.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
