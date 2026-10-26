import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { config } from './config';
import { logger } from './utils/logger';
import { GameSessionManager } from './game/GameSessionManager';
import { DynamoDBRepository } from './repositories/DynamoDBRepository';
import { SQSMatchConsumer } from './consumers/SQSMatchConsumer';
import { SNSEventPublisher } from './publishers/SNSEventPublisher';
import { setupRoutes } from './api/routes';
import { setupWebSocket } from './api/websocket';

dotenv.config();

async function main() {
  try {
    logger.info('Starting Game Engine Service', { env: config.env });

    // Initialize repositories
    const dynamoRepo = new DynamoDBRepository(config.aws);

    // Initialize event publisher
    const eventPublisher = new SNSEventPublisher(config.aws);

    // Initialize game session manager
    const sessionManager = new GameSessionManager(
      dynamoRepo,
      eventPublisher,
      config.game
    );

    // Setup Express app
    const app = express();
    app.use(express.json());

    // Setup HTTP routes
    setupRoutes(app, sessionManager);

    // Create HTTP server
    const httpServer = createServer(app);

    // Setup WebSocket server
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      pingInterval: config.websocket.pingInterval,
      pingTimeout: config.websocket.pingTimeout,
    });

    setupWebSocket(io, sessionManager, config);

    // Start SQS consumer for match events
    const sqsConsumer = new SQSMatchConsumer(
      config.aws.sqsMatchQueueUrl,
      sessionManager,
      config.aws.region
    );
    sqsConsumer.start();

    // Start HTTP server
    const port = config.port;
    httpServer.listen(port, () => {
      logger.info(`Game Engine listening on port ${port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      sqsConsumer.stop();
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      sqsConsumer.stop();
      httpServer.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start service', { error });
    process.exit(1);
  }
}

main();
