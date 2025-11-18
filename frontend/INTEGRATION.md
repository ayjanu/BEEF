# Frontend-Backend Integration Guide

This document outlines the current state of backend integration in the Beefmobile frontend, including completed integrations, pending tasks, and implementation notes.

## Overview

The frontend has been significantly enhanced with backend integration capabilities:
- Extended API client with 28+ endpoints
- Zustand state management for authentication
- Custom hooks for consistent API error handling
- Key components integrated with backend services

## Completed Integrations

### 1. Authentication System

**Files Modified:**
- `src/store/useAuthStore.ts` (NEW)
- `src/hooks/useApiCall.ts` (NEW)
- `src/components/BeefApp.tsx`

**Features:**
- Global authentication state with Zustand
- Persistent storage (localStorage)
- Automatic token management
- On-mount authentication check
- Loading states during auth verification

**Usage Example:**
```typescript
import { useAuthStore } from './store/useAuthStore';

const { user, isAuthenticated, login, logout } = useAuthStore();

// Login
const success = await login('user@example.com', 'password');

// Access user data
console.log(user?.displayName, user?.mmr);
```

**Integration Points:**
- ✅ BeefApp.tsx: Checks auth on mount (lines 14-19, 22-26)
- ⏳ WelcomeScreen: Social auth buttons need wiring
- ⏳ RegistrationFlow: Form submission needs connection

### 2. Profile Tab Integration

**File:** `src/components/tabs/ProfileTab.tsx`

**Backend Calls:**
- `apiClient.getPlayerStats()` - Loads user statistics
- `apiClient.getGameHistory()` - Loads match history
- `apiClient.getAchievements()` - Loads achievement progress

**Features:**
- Real-time stat loading from backend
- Loading states for async operations
- Fallback to user store data
- Empty state handling for no game history
- Automatic calculation of win rate and other derived stats

**Integration Status:**
- ✅ Profile header with user data
- ✅ Stats tab with performance metrics
- ✅ History tab with game results
- ⏳ Achievements tab (using mock data, TODO: integrate backend)
- ⏳ Leaderboards tab (using mock data, TODO: integrate backend)
- ⏳ Social stats (friends/followers count)

**Lines of Interest:**
- Profile data: Lines 32-77
- Stats display: Lines 107-118, 127-139, 170-198
- History rendering: Lines 268-304

### 3. Discover Tab Integration

**File:** `src/components/tabs/DiscoverTab.tsx`

**Backend Calls:**
- `apiClient.getLiveGames()` - Fetches active games
- `apiClient.getNearbyVenues()` - Loads Level 4 venues
- `apiClient.joinQueue()` - Enters matchmaking queue

**Features:**
- Live game discovery
- Nearby venue recommendations
- Matchmaking queue entry
- Loading states and error handling
- Queue status indication

**Integration Status:**
- ✅ Matchmaking queue integration
- ✅ Live games loading (lines 65-71)
- ✅ Nearby venues with geolocation (lines 74-83)
- ✅ Join queue handler (lines 91-112)
- ⏳ Quick match display needs backend data
- ⏳ Search functionality

**TODO:**
- Implement actual geolocation instead of hardcoded coordinates (line 80)
- Connect quick match cards to live game data
- Add search API integration

### 4. Matchmaking Tab Integration

**File:** `src/components/tabs/MatchmakingTab.tsx`

**Backend Calls:**
- `apiClient.getMatchmakingProfiles()` - Loads dating-style profiles
- `apiClient.likeProfile()` - Swipe right / challenge
- `apiClient.passProfile()` - Swipe left / skip

**Features:**
- Profile card browsing with swipe gestures
- Like/pass backend integration
- Match notifications (toast on mutual match)
- Automatic profile refresh from backend
- Fallback to mock data if backend unavailable

**Integration Status:**
- ✅ Profile loading from backend (lines 66-77)
- ✅ Like/pass API calls (lines 83-102)
- ✅ Match notification system
- ✅ Loading state handling (lines 104-110)
- ✅ Graceful degradation to fallback data

**User Flow:**
1. Profiles load from `getMatchmakingProfiles()`
2. User swipes right → `likeProfile()` called
3. If mutual match → Toast notification appears
4. User swipes left → `passProfile()` called

## API Client Extensions

**File:** `src/lib/api-client.ts`

### New Endpoints Added (Lines 239-496):

#### Authentication (Lines 274-313)
- `register()` - User registration
- `login()` - Email/password login
- `socialAuth()` - Google/Apple/Facebook OAuth
- `logout()` - Session termination
- `refreshToken()` - Token refresh

#### User Profile (Lines 243-268)
- `getUserProfile()` - Get user details
- `updateUserProfile()` - Update profile
- `getPlayerStats()` - Get game statistics
- `getGameHistory()` - Match history
- `getAchievements()` - Achievement progress

#### Social Features (Lines 318-338)
- `getFriends()` - Friends list
- `sendFriendRequest()` - Add friend
- `acceptFriendRequest()` - Accept request
- `removeFriend()` - Remove friend

#### Feed & Social (Lines 344-372)
- `getFeed()` - Social feed posts
- `getStories()` - User stories
- `createPost()` - Create post
- `likePost()` - Like post
- `commentPost()` - Comment on post

#### Matchmaking (Lines 378-397)
- `getMatchmakingProfiles()` - Browse profiles
- `likeProfile()` - Challenge user
- `passProfile()` - Skip profile
- `getMatches()` - View mutual matches

#### Challenges (Lines 403-428)
- `createChallenge()` - Direct challenge
- `acceptChallenge()` - Accept challenge
- `declineChallenge()` - Decline challenge
- `getChallenges()` - List challenges

#### Leaderboards (Lines 434-443)
- `getLeaderboards()` - Ranking data
- `getUserRank()` - Current rank

#### Discovery (Lines 449-462)
- `getLiveGames()` - Active games
- `getNearbyVenues()` - Level 4 locations
- `searchGames()` - Search functionality

#### Chat (Lines 468-483)
- `getConversations()` - Chat list
- `getMessages()` - Message history
- `sendMessage()` - Send message

## Pending Integrations

### High Priority

1. **WelcomeScreen Social Auth** (Lines: TBD)
   - Wire up Google/Apple/Facebook buttons to `socialAuth()`
   - Handle OAuth redirect flow
   - File: `src/components/onboarding/WelcomeScreen.tsx`

2. **RegistrationFlow Form Submission** (Lines: TBD)
   - Connect form to `apiClient.register()`
   - Add validation and error display
   - File: `src/components/onboarding/RegistrationFlow.tsx`

3. **BeefsTab Backend Integration** (Lines: TBD)
   - Load active matches with `getMatches()`
   - Display match status and actions
   - File: `src/components/tabs/BeefsTab.tsx`

4. **FeedTab Backend Integration** (Lines: TBD)
   - Load feed with `getFeed()`
   - Load stories with `getStories()`
   - Implement post creation
   - File: `src/components/tabs/FeedTab.tsx`

5. **ChatScreen WebSocket Integration** (Lines: TBD)
   - Connect to Socket.IO for real-time chat
   - Use REST API fallback for message history
   - File: `src/components/ChatScreen.tsx` (if exists)

### Medium Priority

6. **GameScreen WebSocket Integration** (Lines: TBD)
   - Connect to game session WebSocket
   - Handle real-time game state updates
   - Submit game actions
   - File: `src/components/GameScreen.tsx` (if exists)

7. **Leaderboard Integration** (ProfileTab)
   - Replace mock leaderboard data
   - Use `apiClient.getLeaderboards()`
   - File: `src/components/tabs/ProfileTab.tsx` (lines 307-327)

8. **Achievements Integration** (ProfileTab)
   - Replace mock achievements
   - Use `apiClient.getAchievements()`
   - File: `src/components/tabs/ProfileTab.tsx` (lines 244-265)

9. **Social Stats Integration** (ProfileTab)
   - Load friends count from `getFriends()`
   - Display real follower/following counts
   - File: `src/components/tabs/ProfileTab.tsx` (lines 201-221)

10. **Search Functionality** (DiscoverTab)
    - Implement `searchGames()` integration
    - Add debouncing for search input
    - File: `src/components/tabs/DiscoverTab.tsx` (lines 132-136)

### Low Priority

11. **Profile Edit Modal**
    - Create modal/screen for profile editing
    - Use `updateUserProfile()` on submit
    - Location: ProfileTab "Edit" button (line 119)

12. **Settings Screen**
    - User preferences
    - Logout functionality
    - Account management
    - Location: ProfileTab Settings button (line 60)

## WebSocket Integration Plan

### Socket.IO Client Setup

**Dependencies:**
- `socket.io-client: ^4.7.2` (already added to package.json)

**Implementation Locations:**

1. **Game Session WebSocket** (`src/lib/game-socket.ts` - NEW)
```typescript
import { io, Socket } from 'socket.io-client';
import { apiClient } from './api-client';

class GameSocketClient {
  private socket: Socket | null = null;

  connect(sessionId: string) {
    const token = apiClient.getAuthToken();
    this.socket = io(GAME_ENGINE_URL, {
      auth: { token },
      query: { sessionId }
    });

    this.socket.on('gameState', (state) => {
      // Handle game state updates
    });

    this.socket.on('playerAction', (action) => {
      // Handle opponent actions
    });
  }

  submitAction(action: any) {
    this.socket?.emit('gameAction', action);
  }
}

export const gameSocket = new GameSocketClient();
```

2. **Chat WebSocket** (`src/lib/chat-socket.ts` - NEW)
```typescript
// Similar structure for real-time chat
```

3. **Matchmaking WebSocket** (`src/lib/matchmaking-socket.ts` - NEW)
```typescript
// Real-time queue updates, match found notifications
```

## Error Handling & Loading States

### Current Implementation

**useApiCall Hook** (`src/hooks/useApiCall.ts`)
- Automatic loading state management
- Error handling with toast notifications
- Success callbacks
- Data/error/loading state return

**Features:**
- `showErrorToast` - Display errors automatically
- `showSuccessToast` - Display success messages
- `onSuccess` - Success callback
- `onError` - Error callback

**Usage Example:**
```typescript
const { data, loading, error, execute } = useApiCall(apiClient.getPlayerStats, {
  showErrorToast: true,
  onSuccess: (stats) => console.log('Stats loaded:', stats),
  onError: (err) => console.error('Failed:', err)
});
```

### Loading State Patterns

1. **Inline Loading Text:**
```typescript
{loading ? '...' : value}
```
Used in: ProfileTab stats display

2. **Loading Component:**
```typescript
{loading ? (
  <div className="text-center py-8">Loading...</div>
) : (
  <Content />
)}
```
Used in: ProfileTab history, MatchmakingTab

3. **Disabled State:**
```typescript
<Button disabled={isInQueue}>
  {isInQueue ? 'Searching...' : 'Join Queue'}
</Button>
```
Used in: DiscoverTab matchmaking button

## Environment Variables

**File:** `frontend/.env`

Required environment variables:
```bash
VITE_API_BASE_URL=http://localhost:8080
VITE_GAME_ENGINE_URL=http://localhost:8081
```

**For Production:**
```bash
VITE_API_BASE_URL=https://api.beefmobile.com
VITE_GAME_ENGINE_URL=https://game-engine.beefmobile.com
```

## Testing Integration

### Manual Testing Checklist

- [ ] Registration flow submits to backend
- [ ] Login flow authenticates successfully
- [ ] Profile tab loads user stats
- [ ] Game history displays correctly
- [ ] Matchmaking queue entry works
- [ ] Profile swiping (like/pass) works
- [ ] Match notifications appear
- [ ] Live games load on Discover tab
- [ ] Nearby venues display
- [ ] Loading states appear during API calls
- [ ] Error toasts display on failures
- [ ] Authentication persists on reload

### Integration Test Locations

```bash
# Backend services should be running
cd services/matchmaking && go run cmd/server/main.go
cd services/game-engine && npm run dev

# Frontend development server
cd frontend && npm run dev
```

## Known Issues & Limitations

1. **Geolocation Hardcoded:**
   - DiscoverTab uses hardcoded San Francisco coordinates
   - TODO: Implement browser geolocation API

2. **Mock Data Still Present:**
   - Achievements (ProfileTab)
   - Leaderboards (ProfileTab)
   - Quick matches (DiscoverTab) - partially integrated
   - Social stats (ProfileTab)

3. **TypeScript Strict Mode:**
   - Some `any` types remain (gameHistory mapping, etc.)
   - Should be replaced with proper types from shared/types

4. **WebSocket Not Implemented:**
   - Real-time features pending
   - Chat, live games, matchmaking notifications

5. **OAuth Redirect Flow:**
   - Social auth buttons not connected
   - Requires frontend routing for callback handling

## Next Steps

### Immediate (This Week)

1. Integrate WelcomeScreen social authentication
2. Connect RegistrationFlow to backend
3. Add WebSocket support for matchmaking updates
4. Replace remaining mock data in ProfileTab

### Short Term (Next Sprint)

5. Implement ChatScreen with Socket.IO
6. Add GameScreen with real-time state sync
7. Create Settings screen with logout
8. Add profile editing functionality

### Medium Term (Next Month)

9. Implement proper TypeScript types throughout
10. Add comprehensive error boundaries
11. Implement offline support / service worker
12. Add loading skeletons instead of text

## Support & Resources

- **API Documentation:** See `shared/contracts/openapi.yaml`
- **Backend Services:** `docs/ARCHITECTURE.md`
- **Type Definitions:** `shared/types/src/index.ts`
- **Testing Guide:** `docs/TESTING.md`

## Code Patterns & Best Practices

### Pattern 1: Component with Backend Data

```typescript
export function MyComponent() {
  const { user } = useAuthStore();

  const { data, loading, execute } = useApiCall(apiClient.getSomeData, {
    showErrorToast: true
  });

  useEffect(() => {
    execute();
  }, []);

  if (loading) return <LoadingState />;
  if (!data) return <EmptyState />;

  return <Content data={data} />;
}
```

### Pattern 2: Mutation with Optimistic Update

```typescript
const handleAction = async () => {
  // Optimistic UI update
  setLocalState(newValue);

  const response = await apiClient.doAction(params);

  if (!response.success) {
    // Rollback on failure
    setLocalState(oldValue);
    toast.error(response.error?.message);
  } else {
    toast.success('Action completed!');
  }
};
```

### Pattern 3: Protected Action

```typescript
const handleProtectedAction = async () => {
  if (!user) {
    toast.error('Please sign in first');
    return;
  }

  // Proceed with action
};
```

## Conclusion

The frontend now has a solid foundation for backend integration:
- ✅ Authentication system with persistence
- ✅ API client with 28+ endpoints
- ✅ State management (Zustand)
- ✅ Consistent error handling
- ✅ Loading state patterns
- ✅ Key components integrated (Profile, Discover, Matchmaking)

**Next priority:** Complete remaining component integrations and add real-time WebSocket support.

For questions or issues, refer to the main project README or reach out to the development team.
