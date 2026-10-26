import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';

/** The access token lives in the OS keychain/keystore, never in plain storage. */
const KEY = 'beef.session';

export interface AuthState {
  token: string | null;
  userId: string | null;
  hydrated: boolean;
}

const initialState: AuthState = { token: null, userId: null, hydrated: false };

export const hydrateAuth = createAsyncThunk('auth/hydrate', async () => {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? (JSON.parse(raw) as { token: string; userId: string }) : null;
});

export const signIn = createAsyncThunk('auth/signIn', async (s: { token: string; userId: string }) => {
  await SecureStore.setItemAsync(KEY, JSON.stringify(s));
  return s;
});

export const signOut = createAsyncThunk('auth/signOut', async () => {
  await SecureStore.deleteItemAsync(KEY);
});

const slice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    tokenRefreshed(state, action: PayloadAction<string>) {
      state.token = action.payload;
    },
  },
  extraReducers: (b) => {
    b.addCase(hydrateAuth.fulfilled, (s, a) => {
      s.token = a.payload?.token ?? null;
      s.userId = a.payload?.userId ?? null;
      s.hydrated = true;
    });
    b.addCase(hydrateAuth.rejected, (s) => {
      s.hydrated = true;
    });
    b.addCase(signIn.fulfilled, (s, a) => {
      s.token = a.payload.token;
      s.userId = a.payload.userId;
    });
    b.addCase(signOut.fulfilled, (s) => {
      s.token = null;
      s.userId = null;
    });
  },
});

export const { tokenRefreshed } = slice.actions;
export default slice.reducer;
