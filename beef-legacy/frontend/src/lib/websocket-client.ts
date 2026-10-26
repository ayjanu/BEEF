/**
 * WebSocket Client for Real-Time Game Communication
 * Uses Socket.IO to connect to Game Engine service
 */

import { io, Socket } from 'socket.io-client';

// ============================================================================
// Configuration
// ============================================================================

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8081';

// ============================================================================
// Types
// ============================================================================

export interface WebSocketEvents {
  // Connection events
  connect: () => void;
  disconnect: () => void;
  error: (error: any) => void;

  // Session events
  'session-joined': (data: { sessionId: string }) => void;
  'player-connected': (data: { userId: string }) => void;
  'player-disconnected': (data: { userId: string }) => void;

  // Game events
  'game-state': (state: any) => void;
  'action-error': (error: { message: string }) => void;
}

// ============================================================================
// WebSocket Client Class
// ============================================================================

class WebSocketClient {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private sessionId: string | null = null;

  /**
   * Connect to WebSocket server
   */
  connect(token?: string): Socket {
    if (this.socket && this.connected) {
      return this.socket;
    }

    const options: any = {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    };

    if (token) {
      options.auth = { token };
    }

    this.socket = io(WS_URL, options);

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('✅ WebSocket connected');
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('❌ WebSocket disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });

    return this.socket;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.sessionId = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && !!this.socket;
  }

  /**
   * Get Socket.IO instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  // ========================================================================
  // Session Management
  // ========================================================================

  /**
   * Join a game session
   */
  joinSession(sessionId: string, userId: string): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }

    this.sessionId = sessionId;
    this.socket.emit('join-session', { sessionId, userId });
  }

  /**
   * Leave current game session
   */
  leaveSession(userId: string): void {
    if (!this.socket || !this.sessionId) {
      return;
    }

    this.socket.emit('leave-session', {
      sessionId: this.sessionId,
      userId,
    });

    this.sessionId = null;
  }

  // ========================================================================
  // Game Actions
  // ========================================================================

  /**
   * Submit a game action
   */
  submitAction(userId: string, actionType: string, payload: any): void {
    if (!this.socket || !this.sessionId) {
      throw new Error('Not in a game session');
    }

    this.socket.emit('game-action', {
      sessionId: this.sessionId,
      userId,
      actionType,
      payload,
    });
  }

  // ========================================================================
  // Event Listeners
  // ========================================================================

  /**
   * Listen to an event
   */
  on<K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.on(event as string, handler);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof WebSocketEvents>(
    event: K,
    handler?: WebSocketEvents[K]
  ): void {
    if (!this.socket) {
      return;
    }
    this.socket.off(event as string, handler as any);
  }

  /**
   * Listen to an event once
   */
  once<K extends keyof WebSocketEvents>(
    event: K,
    handler: WebSocketEvents[K]
  ): void {
    if (!this.socket) {
      throw new Error('WebSocket not connected');
    }
    this.socket.once(event as string, handler);
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Send ping to check connection
   */
  ping(): void {
    if (!this.socket) {
      return;
    }
    this.socket.emit('ping');
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId(): string | null {
    return this.sessionId;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const wsClient = new WebSocketClient();

// ============================================================================
// React Hook
// ============================================================================

import { useEffect, useState } from 'react';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = wsClient.connect();

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  return {
    client: wsClient,
    connected,
  };
}

/**
 * Hook for listening to game state updates
 */
export function useGameState(onStateUpdate: (state: any) => void) {
  useEffect(() => {
    wsClient.on('game-state', onStateUpdate);

    return () => {
      wsClient.off('game-state', onStateUpdate);
    };
  }, [onStateUpdate]);
}

/**
 * Hook for handling game session
 */
export function useGameSession(sessionId: string | null, userId: string) {
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const handleSessionJoined = () => {
      setJoined(true);
    };

    wsClient.on('session-joined', handleSessionJoined);
    wsClient.joinSession(sessionId, userId);

    return () => {
      wsClient.off('session-joined', handleSessionJoined);
      wsClient.leaveSession(userId);
      setJoined(false);
    };
  }, [sessionId, userId]);

  return { joined };
}
