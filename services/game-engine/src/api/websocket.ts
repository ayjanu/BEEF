import { Server as SocketIOServer, Socket } from 'socket.io';
import { GameSessionManager } from '../game/GameSessionManager';
import { logger } from '../utils/logger';
import { Config } from '../config';

export function setupWebSocket(
  io: SocketIOServer,
  sessionManager: GameSessionManager,
  config: Config
): void {
  io.on('connection', (socket: Socket) => {
    logger.info('Client connected', { socketId: socket.id });

    // Join game session
    socket.on('join-session', async (data: { sessionId: string; userId: string }) => {
      try {
        const { sessionId, userId } = data;

        // Validate session exists
        const session = await sessionManager.getSession(sessionId);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        // Join socket room for this session
        socket.join(sessionId);

        // Mark player as connected
        await sessionManager.playerConnect(sessionId, userId);

        socket.emit('session-joined', { sessionId });

        // Broadcast to other players
        socket.to(sessionId).emit('player-connected', { userId });

        // Send current game state
        socket.emit('game-state', session.gameState);

        logger.info('Player joined session', { sessionId, userId, socketId: socket.id });
      } catch (error: any) {
        logger.error('Failed to join session', { error });
        socket.emit('error', { message: error.message });
      }
    });

    // Handle game action
    socket.on('game-action', async (data: {
      sessionId: string;
      userId: string;
      actionType: string;
      payload: any;
    }) => {
      try {
        const { sessionId, userId, actionType, payload } = data;

        // Process action
        const newState = await sessionManager.processAction(sessionId, userId, actionType, payload);

        // Broadcast new state to all players in session
        io.to(sessionId).emit('game-state', newState);

        logger.debug('Game action processed', { sessionId, userId, actionType });
      } catch (error: any) {
        logger.error('Failed to process action', { error });
        socket.emit('action-error', { message: error.message });
      }
    });

    // Leave session
    socket.on('leave-session', async (data: { sessionId: string; userId: string }) => {
      try {
        const { sessionId, userId } = data;

        socket.leave(sessionId);
        await sessionManager.playerDisconnect(sessionId, userId);

        // Notify other players
        socket.to(sessionId).emit('player-disconnected', { userId });

        logger.info('Player left session', { sessionId, userId });
      } catch (error) {
        logger.error('Failed to leave session', { error });
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info('Client disconnected', { socketId: socket.id });
      // TODO: Handle cleanup for any sessions this socket was in
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });

  logger.info('WebSocket server configured');
}
