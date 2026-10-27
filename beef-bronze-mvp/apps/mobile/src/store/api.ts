import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  AuthResult,
  Challenge,
  ChallengeCreateRequest,
  Comment,
  FeedPage,
  FeedPost,
  ReactionKind,
  SocialCounts,
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
  tagTypes: ['Me', 'Deck', 'Threads', 'Challenges', 'Wallet', 'Leaderboard', 'Sessions', 'Feed', 'Comments', 'Social'],
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
    // ---------- social ----------
    /** Pages merge into one list; pass the previous page's `next` to load more. */
    feed: b.query<FeedPage, string | null>({
      query: (before) => (before ? `/v1/feed?before=${encodeURIComponent(before)}` : '/v1/feed'),
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (cache, page, { arg }) => {
        if (!arg) return page;
        const seen = new Set(cache.posts.map((p) => p.id));
        return { posts: [...cache.posts, ...page.posts.filter((p) => !seen.has(p.id))], next: page.next };
      },
      forceRefetch: ({ currentArg, previousArg }) => currentArg !== previousArg,
      providesTags: ['Feed'],
    }),
    react: b.mutation<FeedPost, { postId: string; kind: ReactionKind | null }>({
      query: ({ postId, kind }) =>
        kind
          ? { url: `/v1/posts/${postId}/reaction`, method: 'PUT', body: { kind } }
          : { url: `/v1/posts/${postId}/reaction`, method: 'DELETE' },
      // Patch the cached card in place instead of refetching the whole feed.
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(
          api.util.updateQueryData('feed', null, (draft) => {
            const i = draft.posts.findIndex((p) => p.id === data.id);
            if (i >= 0) draft.posts[i] = data;
          }),
        );
      },
    }),
    hidePost: b.mutation<{ hidden: boolean }, string>({
      query: (postId) => ({ url: `/v1/posts/${postId}/hide`, method: 'POST' }),
      invalidatesTags: ['Feed'],
    }),
    comments: b.query<Comment[], string>({ query: (postId) => `/v1/posts/${postId}/comments`, providesTags: ['Comments'] }),
    addComment: b.mutation<Comment, { postId: string; body: string }>({
      query: ({ postId, body }) => ({ url: `/v1/posts/${postId}/comments`, method: 'POST', body: { body } }),
      invalidatesTags: ['Comments', 'Feed'],
    }),
    social: b.query<SocialCounts, string>({ query: (userId) => `/v1/users/${userId}/social`, providesTags: ['Social'] }),
    follow: b.mutation<SocialCounts, { userId: string; follow: boolean }>({
      query: ({ userId, follow }) => ({ url: `/v1/follows/${userId}`, method: follow ? 'PUT' : 'DELETE' }),
      invalidatesTags: ['Social', 'Feed'],
    }),
    block: b.mutation<{ blocked: boolean }, string>({
      query: (userId) => ({ url: `/v1/blocks/${userId}`, method: 'PUT' }),
      invalidatesTags: ['Social', 'Feed', 'Threads', 'Deck', 'Challenges'],
    }),
    rematch: b.mutation<Challenge, string>({
      query: (sessionId) => ({ url: `/v1/sessions/${sessionId}/rematch`, method: 'POST' }),
      invalidatesTags: ['Challenges'],
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
  useFeedQuery,
  useReactMutation,
  useHidePostMutation,
  useCommentsQuery,
  useAddCommentMutation,
  useSocialQuery,
  useFollowMutation,
  useBlockMutation,
  useRematchMutation,
} = api;

/** Pulls the server's error code out of an RTK Query error, for user-facing messages. */
export function errorCode(err: unknown): string | null {
  const data = (err as { data?: { error?: string; message?: { error?: string } } })?.data;
  return data?.error ?? data?.message?.error ?? null;
}
