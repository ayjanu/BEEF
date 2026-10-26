/**
 * API Client for Beefmobile Backend Services
 * Handles REST API calls to Matchmaking and Game Engine services
 */

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const GAME_ENGINE_URL = import.meta.env.VITE_GAME_ENGINE_URL || 'http://localhost:8081';

// ============================================================================
// Types
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    statusCode: number;
  };
}

export interface MatchmakingRequest {
  region: string;
  gameMode: string;
}

export interface MatchmakingResponse {
  queueId: string;
  position: number;
  estimatedWaitTime: number;
  status: string;
}

export interface Match {
  matchId: string;
  players: Array<{
    userId: string;
    mmr: number;
    accepted: boolean;
  }>;
  region: string;
  gameMode: string;
  status: string;
}

export interface GameSession {
  sessionId: string;
  matchId: string;
  gameMode: string;
  region: string;
  players: Array<{
    userId: string;
    username: string;
    connected: boolean;
    ready: boolean;
    score: number;
  }>;
  status: string;
  gameState: any;
}

// ============================================================================
// API Client Class
// ============================================================================

class ApiClient {
  private token: string | null = null;

  setAuthToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  getAuthToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token');
    }
    return this.token;
  }

  clearAuthToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    const token = this.getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.code || 'UNKNOWN_ERROR',
            message: data.message || 'An error occurred',
            statusCode: response.status,
            details: data.details,
          },
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error.message || 'Network request failed',
          statusCode: 0,
        },
      };
    }
  }

  // ========================================================================
  // Matchmaking API
  // ========================================================================

  async joinQueue(request: MatchmakingRequest): Promise<ApiResponse<MatchmakingResponse>> {
    return this.request<MatchmakingResponse>(
      `${API_BASE_URL}/v1/matchmaking/queue/join`,
      {
        method: 'POST',
        body: JSON.stringify(request),
      }
    );
  }

  async leaveQueue(): Promise<ApiResponse<void>> {
    return this.request<void>(`${API_BASE_URL}/v1/matchmaking/queue/leave`, {
      method: 'DELETE',
    });
  }

  async getQueueStatus(): Promise<ApiResponse<MatchmakingResponse>> {
    return this.request<MatchmakingResponse>(
      `${API_BASE_URL}/v1/matchmaking/queue/status`
    );
  }

  async acceptMatch(matchId: string): Promise<ApiResponse<Match>> {
    return this.request<Match>(
      `${API_BASE_URL}/v1/matchmaking/match/${matchId}/accept`,
      {
        method: 'POST',
      }
    );
  }

  async declineMatch(matchId: string): Promise<ApiResponse<void>> {
    return this.request<void>(
      `${API_BASE_URL}/v1/matchmaking/match/${matchId}/decline`,
      {
        method: 'POST',
      }
    );
  }

  async getMatch(matchId: string): Promise<ApiResponse<Match>> {
    return this.request<Match>(
      `${API_BASE_URL}/v1/matchmaking/match/${matchId}`
    );
  }

  async getMatchHistory(page = 1, pageSize = 20): Promise<ApiResponse<any>> {
    return this.request(
      `${API_BASE_URL}/v1/matchmaking/history?page=${page}&pageSize=${pageSize}`
    );
  }

  // ========================================================================
  // Game Engine API
  // ========================================================================

  async getGameSession(sessionId: string): Promise<ApiResponse<GameSession>> {
    return this.request<GameSession>(
      `${GAME_ENGINE_URL}/v1/game/session/${sessionId}`
    );
  }

  async submitGameAction(
    sessionId: string,
    userId: string,
    actionType: string,
    payload: any
  ): Promise<ApiResponse<any>> {
    return this.request(
      `${GAME_ENGINE_URL}/v1/game/session/${sessionId}/action`,
      {
        method: 'POST',
        body: JSON.stringify({
          userId,
          actionType,
          payload,
        }),
      }
    );
  }

  async endGameSession(sessionId: string, winnerId: string): Promise<ApiResponse<any>> {
    return this.request(`${GAME_ENGINE_URL}/v1/game/session/${sessionId}/end`, {
      method: 'POST',
      body: JSON.stringify({ winnerId }),
    });
  }

  async getActiveSessions(): Promise<ApiResponse<any>> {
    return this.request(`${GAME_ENGINE_URL}/v1/game/sessions/active`);
  }

  // ========================================================================
  // User & Profile API
  // ========================================================================

  async getUserProfile(userId?: string): Promise<ApiResponse<any>> {
    const path = userId ? `/v1/users/${userId}` : '/v1/users/me';
    return this.request(`${API_BASE_URL}${path}`);
  }

  async updateUserProfile(data: any): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/v1/users/me`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getPlayerStats(userId?: string): Promise<ApiResponse<any>> {
    const path = userId ? `/v1/users/${userId}/stats` : '/v1/users/me/stats';
    return this.request(`${API_BASE_URL}${path}`);
  }

  async getGameHistory(page = 1, pageSize = 20): Promise<ApiResponse<any>> {
    return this.request(
      `${API_BASE_URL}/v1/users/me/history?page=${page}&pageSize=${pageSize}`
    );
  }

  async getAchievements(): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/v1/users/me/achievements`);
  }

  // ========================================================================
  // Authentication API
  // ========================================================================

  async register(data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
    region: string;
  }): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request(`${API_BASE_URL}/v1/auth/register`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(email: string, password: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request(`${API_BASE_URL}/v1/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async socialAuth(provider: 'google' | 'apple' | 'facebook', token: string): Promise<ApiResponse<{ token: string; user: any }>> {
    return this.request(`${API_BASE_URL}/v1/auth/social/${provider}`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    this.clearAuthToken();
    return this.request(`${API_BASE_URL}/v1/auth/logout`, {
      method: 'POST',
    });
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.request(`${API_BASE_URL}/v1/auth/refresh`, {
      method: 'POST',
    });
  }

  // ========================================================================
  // Social & Friends API
  // ========================================================================

  async getFriends(): Promise<ApiResponse<any[]>> {
    return this.request(`${API_BASE_URL}/v1/users/me/friends`);
  }

  async sendFriendRequest(userId: string): Promise<ApiResponse<void>> {
    return this.request(`${API_BASE_URL}/v1/users/me/friends/${userId}`, {
      method: 'POST',
    });
  }

  async acceptFriendRequest(userId: string): Promise<ApiResponse<void>> {
    return this.request(`${API_BASE_URL}/v1/users/me/friends/${userId}/accept`, {
      method: 'POST',
    });
  }

  async removeFriend(userId: string): Promise<ApiResponse<void>> {
    return this.request(`${API_BASE_URL}/v1/users/me/friends/${userId}`, {
      method: 'DELETE',
    });
  }

  // ========================================================================
  // Feed & Social API
  // ========================================================================

  async getFeed(filter = 'all', page = 1, pageSize = 20): Promise<ApiResponse<any>> {
    return this.request(
      `${API_BASE_URL}/v1/feed?filter=${filter}&page=${page}&pageSize=${pageSize}`
    );
  }

  async getStories(): Promise<ApiResponse<any[]>> {
    return this.request(`${API_BASE_URL}/v1/feed/stories`);
  }

  async createPost(data: { content: string; media?: string[] }): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/v1/feed/posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async likePost(postId: string): Promise<ApiResponse<void>> {
    return this.request(`${API_BASE_URL}/v1/feed/posts/${postId}/like`, {
      method: 'POST',
    });
  }

  async commentPost(postId: string, comment: string): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/v1/feed/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: comment }),
    });
  }

  // ========================================================================
  // Matchmaking Profile API
  // ========================================================================

  async getMatchmakingProfiles(preferences?: any): Promise<ApiResponse<any[]>> {
    const query = preferences ? `?${new URLSearchParams(preferences)}` : '';
    return this.request(`${API_BASE_URL}/v1/matchmaking/profiles${query}`);
  }

  async likeProfile(profileId: string): Promise<ApiResponse<{ isMatch: boolean; match?: any }>> {
    return this.request(`${API_BASE_URL}/v1/matchmaking/profiles/${profileId}/like`, {
      method: 'POST',
    });
  }

  async passProfile(profileId: string): Promise<ApiResponse<void>> {
    return this.request(`${API_BASE_URL}/v1/matchmaking/profiles/${profileId}/pass`, {
      method: 'POST',
    });
  }

  async getMatches(): Promise<ApiResponse<any[]>> {
    return this.request(`${API_BASE_URL}/v1/matchmaking/matches`);
  }

  // ========================================================================
  // Challenge & Game Invitation API
  // ========================================================================

  async createChallenge(data: {
    opponentId: string;
    gameType: string;
    wager?: number;
  }): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/v1/challenges`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acceptChallenge(challengeId: string): Promise<ApiResponse<{ sessionId: string }>> {
    return this.request(`${API_BASE_URL}/v1/challenges/${challengeId}/accept`, {
      method: 'POST',
    });
  }

  async declineChallenge(challengeId: string): Promise<ApiResponse<void>> {
    return this.request(`${API_BASE_URL}/v1/challenges/${challengeId}/decline`, {
      method: 'POST',
    });
  }

  async getChallenges(): Promise<ApiResponse<any[]>> {
    return this.request(`${API_BASE_URL}/v1/challenges`);
  }

  // ========================================================================
  // Leaderboards API
  // ========================================================================

  async getLeaderboards(type = 'global', timeframe = 'all'): Promise<ApiResponse<any[]>> {
    return this.request(
      `${API_BASE_URL}/v1/leaderboards/${type}?timeframe=${timeframe}`
    );
  }

  async getUserRank(userId?: string): Promise<ApiResponse<any>> {
    const path = userId ? `/v1/leaderboards/rank/${userId}` : '/v1/leaderboards/rank/me';
    return this.request(`${API_BASE_URL}${path}`);
  }

  // ========================================================================
  // Discovery API
  // ========================================================================

  async getLiveGames(filter?: string): Promise<ApiResponse<any[]>> {
    const query = filter ? `?filter=${filter}` : '';
    return this.request(`${GAME_ENGINE_URL}/v1/game/live${query}`);
  }

  async getNearbyVenues(location: { lat: number; lng: number }): Promise<ApiResponse<any[]>> {
    return this.request(
      `${API_BASE_URL}/v1/venues/nearby?lat=${location.lat}&lng=${location.lng}`
    );
  }

  async searchGames(query: string): Promise<ApiResponse<any[]>> {
    return this.request(`${API_BASE_URL}/v1/games/search?q=${encodeURIComponent(query)}`);
  }

  // ========================================================================
  // Chat & Messaging API (REST fallback)
  // ========================================================================

  async getConversations(): Promise<ApiResponse<any[]>> {
    return this.request(`${API_BASE_URL}/v1/chat/conversations`);
  }

  async getMessages(conversationId: string, page = 1): Promise<ApiResponse<any>> {
    return this.request(
      `${API_BASE_URL}/v1/chat/conversations/${conversationId}/messages?page=${page}`
    );
  }

  async sendMessage(conversationId: string, content: string, type = 'text'): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/v1/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type }),
    });
  }

  // ========================================================================
  // Health Checks
  // ========================================================================

  async checkMatchmakingHealth(): Promise<ApiResponse<any>> {
    return this.request(`${API_BASE_URL}/health`);
  }

  async checkGameEngineHealth(): Promise<ApiResponse<any>> {
    return this.request(`${GAME_ENGINE_URL}/health`);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const apiClient = new ApiClient();

// ============================================================================
// Helper Hooks (for React)
// ============================================================================

export function useApiClient() {
  return apiClient;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

export function isApiError(response: ApiResponse): response is Required<Pick<ApiResponse, 'error'>> {
  return !response.success && !!response.error;
}

export function getErrorMessage(response: ApiResponse): string {
  if (isApiError(response)) {
    return response.error.message;
  }
  return 'An unknown error occurred';
}

export function getErrorCode(response: ApiResponse): string {
  if (isApiError(response)) {
    return response.error.code;
  }
  return 'UNKNOWN_ERROR';
}
