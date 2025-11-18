import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { GameSession, GameAction } from '../types';
import { logger } from '../utils/logger';

export class DynamoDBRepository {
  private client: DynamoDBClient;
  private gameSessionsTable: string;
  private gameActionsTable: string;

  constructor(config: { region: string; gameSessionsTable: string; gameActionsTable: string }) {
    this.client = new DynamoDBClient({ region: config.region });
    this.gameSessionsTable = config.gameSessionsTable;
    this.gameActionsTable = config.gameActionsTable;
  }

  async saveGameSession(session: GameSession): Promise<void> {
    try {
      const command = new PutItemCommand({
        TableName: this.gameSessionsTable,
        Item: marshall(session, { removeUndefinedValues: true }),
      });

      await this.client.send(command);
      logger.debug('Game session saved to DynamoDB', { sessionId: session.sessionId });
    } catch (error) {
      logger.error('Failed to save game session', { error, sessionId: session.sessionId });
      throw error;
    }
  }

  async getGameSession(sessionId: string): Promise<GameSession | null> {
    try {
      const command = new GetItemCommand({
        TableName: this.gameSessionsTable,
        Key: marshall({ sessionId }),
      });

      const response = await this.client.send(command);

      if (!response.Item) {
        return null;
      }

      return unmarshall(response.Item) as GameSession;
    } catch (error) {
      logger.error('Failed to get game session', { error, sessionId });
      throw error;
    }
  }

  async saveGameAction(sessionId: string, action: GameAction): Promise<void> {
    try {
      const command = new PutItemCommand({
        TableName: this.gameActionsTable,
        Item: marshall(
          {
            sessionId,
            actionId: action.actionId,
            ...action,
          },
          { removeUndefinedValues: true }
        ),
      });

      await this.client.send(command);
      logger.debug('Game action saved', { sessionId, actionId: action.actionId });
    } catch (error) {
      logger.error('Failed to save game action', { error, sessionId, actionId: action.actionId });
      throw error;
    }
  }
}
