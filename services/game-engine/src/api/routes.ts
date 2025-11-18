import { Express, Request, Response } from 'express';
import { GameSessionManager } from '../game/GameSessionManager';
import { logger } from '../utils/logger';

export function setupRoutes(app: Express, sessionManager: GameSessionManager): void {
  // Health check
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'game-engine',
      activeSessions: sessionManager.getActiveSessions().length,
    });
  });

  // Get game session
  app.get('/v1/game/session/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await sessionManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json(session);
    } catch (error) {
      logger.error('Failed to get session', { error });
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Submit game action (REST fallback for WebSocket)
  app.post('/v1/game/session/:sessionId/action', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { userId, actionType, payload } = req.body;

      if (!userId || !actionType) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const newState = await sessionManager.processAction(sessionId, userId, actionType, payload);

      res.json({ state: newState });
    } catch (error: any) {
      logger.error('Failed to process action', { error });
      res.status(400).json({ error: error.message });
    }
  });

  // End game session
  app.post('/v1/game/session/:sessionId/end', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { winnerId } = req.body;

      if (!winnerId) {
        return res.status(400).json({ error: 'Winner ID required' });
      }

      const result = await sessionManager.endSession(sessionId, winnerId);

      res.json(result);
    } catch (error: any) {
      logger.error('Failed to end session', { error });
      res.status(400).json({ error: error.message });
    }
  });

  // Get active sessions (admin/debug)
  app.get('/v1/game/sessions/active', (req: Request, res: Response) => {
    const sessions = sessionManager.getActiveSessions();
    res.json({
      count: sessions.length,
      sessions: sessions.map((s) => ({
        sessionId: s.sessionId,
        status: s.status,
        players: s.players.length,
        turn: s.gameState.turn,
      })),
    });
  });
}
