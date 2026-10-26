import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';
import { GameSession, GameResult } from '../types';
import { logger } from '../utils/logger';

export class SNSEventPublisher {
  private client: SNSClient;
  private topicArn: string;

  constructor(config: { region: string; snsGameEventsTopicArn: string }) {
    this.client = new SNSClient({ region: config.region });
    this.topicArn = config.snsGameEventsTopicArn;
  }

  async publishGameCreated(session: GameSession): Promise<void> {
    await this.publish('game.created', {
      sessionId: session.sessionId,
      matchId: session.matchId,
      players: session.players.map((p) => p.userId),
      status: session.status,
    });
  }

  async publishGameStarted(session: GameSession): Promise<void> {
    await this.publish('game.started', {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      players: session.players,
    });
  }

  async publishGameStateUpdate(sessionId: string, state: any): Promise<void> {
    await this.publish('game.state.update', {
      sessionId,
      state,
      timestamp: new Date().toISOString(),
    });
  }

  async publishGameEnded(session: GameSession, result: GameResult): Promise<void> {
    await this.publish('game.ended', {
      sessionId: session.sessionId,
      winnerId: session.winner,
      result,
      endedAt: session.endedAt,
    });
  }

  private async publish(eventType: string, payload: any): Promise<void> {
    try {
      const event = {
        eventId: uuidv4(),
        eventType,
        timestamp: new Date().toISOString(),
        payload,
      };

      const command = new PublishCommand({
        TopicArn: this.topicArn,
        Message: JSON.stringify(event),
        MessageAttributes: {
          eventType: {
            DataType: 'String',
            StringValue: eventType,
          },
        },
      });

      await this.client.send(command);
      logger.info('Event published to SNS', { eventType, eventId: event.eventId });
    } catch (error) {
      logger.error('Failed to publish event', { error, eventType });
      throw error;
    }
  }
}
