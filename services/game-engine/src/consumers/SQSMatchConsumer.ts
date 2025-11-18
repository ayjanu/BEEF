import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { GameSessionManager } from '../game/GameSessionManager';
import { Match } from '../types';
import { logger } from '../utils/logger';

export class SQSMatchConsumer {
  private client: SQSClient;
  private queueUrl: string;
  private sessionManager: GameSessionManager;
  private polling: boolean = false;
  private pollingInterval?: NodeJS.Timeout;

  constructor(queueUrl: string, sessionManager: GameSessionManager, region: string) {
    this.client = new SQSClient({ region });
    this.queueUrl = queueUrl;
    this.sessionManager = sessionManager;
  }

  start(): void {
    if (this.polling) {
      logger.warn('SQS consumer already running');
      return;
    }

    this.polling = true;
    logger.info('Starting SQS match consumer', { queueUrl: this.queueUrl });

    this.poll();
  }

  stop(): void {
    this.polling = false;
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
    }
    logger.info('SQS match consumer stopped');
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        await this.receiveMessages();
      } catch (error) {
        logger.error('Error polling SQS', { error });
      }

      // Wait 1 second before next poll
      await new Promise((resolve) => {
        this.pollingInterval = setTimeout(resolve, 1000);
      });
    }
  }

  private async receiveMessages(): Promise<void> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 20, // Long polling
      MessageAttributeNames: ['All'],
    });

    const response = await this.client.send(command);

    if (!response.Messages || response.Messages.length === 0) {
      return;
    }

    for (const message of response.Messages) {
      try {
        await this.processMessage(message);

        // Delete message after successful processing
        await this.deleteMessage(message.ReceiptHandle!);
      } catch (error) {
        logger.error('Failed to process SQS message', { error, messageId: message.MessageId });
      }
    }
  }

  private async processMessage(message: any): Promise<void> {
    if (!message.Body) {
      return;
    }

    const body = JSON.parse(message.Body);

    // SNS messages are wrapped
    const payload = body.Message ? JSON.parse(body.Message) : body;

    // Check event type
    if (payload.eventType === 'matchmaking.match.ready') {
      const match: Match = payload.payload;
      logger.info('Received match ready event', { matchId: match.matchId });

      // Create game session
      await this.sessionManager.createSession(match);
    }
  }

  private async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.client.send(command);
  }
}
