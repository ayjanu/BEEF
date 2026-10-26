import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AuthResult,
  Challenge,
  ChallengeCreateRequest,
  LeaderboardEntry,
  OtpStartRequest,
  OtpVerifyRequest,
  Profile,
  ProfileUpdateRequest,
  ReportCreateRequest,
  Session,
  SwipeRequest,
  SwipeResult,
  Thread,
  Wallet,
} from '@beef/contracts';
import type { GameManifest } from '@beef/game-rules';
import { config } from '../config';
import type { RootState } from './index';

/**
 * RTK Query client for core-api. Request and response types come straight from
 * @beef/contracts, the same schemas the server validates with, so a breaking
 * API change fails this file's typecheck.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: config.apiUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) headers.set('authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Me', 'Deck', 'Threads', 'Challenges', 'Wallet', 'Leaderboard', 'Sessions'],
  endpoints: (b) => ({
    otpStart: b.mutation<{ sent: boolean }, OtpStartRequest>({
      query: (body) => ({ url: '/v1/auth/otp/start', method: 'POST', body }),
    }),
    otpVerify: b.mutation<AuthResult, OtpVerifyRequest>({
      query: (body) => ({ url: '/v1/auth/otp/verify', method: 'POST', body }),
    }),
    me: b.query<Profile, void>({ query: () => '/v1/me', providesTags: ['Me'] }),
    updateProfile: b.mutation<Profile, ProfileUpdateRequest>({
      query: (body) => ({ url: '/v1/me/profile', method: 'PUT', body }),
      invalidatesTags: ['Me', 'Deck'],
    }),
    devLiveness: b.mutation<{ tier: string; token: string }, void>({
      query: () => ({ url: '/v1/me/verify/liveness', method: 'POST' }),
      invalidatesTags: ['Me', 'Deck'],
    }),
    deck: b.query<Profile[], void>({ query: () => '/v1/swipe/deck', providesTags: ['Deck'] }),
    swipe: b.mutation<SwipeResult, SwipeRequest>({
      query: (body) => ({ url: '/v1/swipe', method: 'POST', body }),
      invalidatesTags: (r) => (r?.matched ? ['Threads'] : []),
    }),
    threads: b.query<Thread[], void>({ query: () => '/v1/threads', providesTags: ['Threads'] }),
    games: b.query<GameManifest[], void>({ query: () => '/v1/games' }),
    challenges: b.query<Challenge[], void>({ query: () => '/v1/challenges', providesTags: ['Challenges'] }),
    challenge: b.mutation<Challenge, ChallengeCreateRequest>({
      query: (body) => ({ url: '/v1/challenges', method: 'POST', body }),
      invalidatesTags: ['Challenges'],
    }),
    acceptChallenge: b.mutation<Session, string>({
      query: (id) => ({ url: `/v1/challenges/${id}/accept`, method: 'POST' }),
      invalidatesTags: ['Challenges', 'Sessions'],
    }),
    joinQueue: b.mutation<{ queued: boolean }, { gameId: string }>({
      query: (body) => ({ url: '/v1/queue', method: 'POST', body }),
    }),
    leaveQueue: b.mutation<{ queued: boolean }, string>({
      query: (gameId) => ({ url: `/v1/queue/${gameId}`, method: 'DELETE' }),
    }),
    activeSessions: b.query<Session[], void>({ query: () => '/v1/sessions/active', providesTags: ['Sessions'] }),
    wallet: b.query<Wallet, void>({ query: () => '/v1/me/wallet', providesTags: ['Wallet'] }),
    leaderboard: b.query<LeaderboardEntry[], string>({
      query: (gameId) => `/v1/leaderboards/${gameId}`,
      providesTags: ['Leaderboard'],
    }),
    report: b.mutation<{ id: string }, ReportCreateRequest>({
      query: (body) => ({ url: '/v1/reports', method: 'POST', body }),
    }),
  }),
});

export const {
  useOtpStartMutation,
  useOtpVerifyMutation,
  useMeQuery,
  useUpdateProfileMutation,
  useDevLivenessMutation,
  useDeckQuery,
  useSwipeMutation,
  useThreadsQuery,
  useGamesQuery,
  useChallengesQuery,
  useChallengeMutation,
  useAcceptChallengeMutation,
  useJoinQueueMutation,
  useLeaveQueueMutation,
  useActiveSessionsQuery,
  useWalletQuery,
  useLeaderboardQuery,
  useReportMutation,
} = api;

/** Pulls the server's error code out of an RTK Query error, for user-facing messages. */
export function errorCode(err: unknown): string | null {
  const data = (err as { data?: { error?: string; message?: { error?: string } } })?.data;
  return data?.error ?? data?.message?.error ?? null;
}
