import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

export interface MessagingStackProps {
  environment: string;
}

export class MessagingStack extends Construct {
  public readonly matchmakingTopic: sns.Topic;
  public readonly gameEventsTopic: sns.Topic;
  public readonly matchQueue: sqs.Queue;

  constructor(scope: Construct, id: string, props: MessagingStackProps) {
    super(scope, id);

    const { environment } = props;

    // SNS Topics

    // Matchmaking Events Topic
    this.matchmakingTopic = new sns.Topic(this, 'MatchmakingTopic', {
      displayName: 'Matchmaking Events',
      topicName: `beefmobile-matchmaking-events-${environment}`,
    });

    // Game Events Topic
    this.gameEventsTopic = new sns.Topic(this, 'GameEventsTopic', {
      displayName: 'Game Events',
      topicName: `beefmobile-game-events-${environment}`,
    });

    // SQS Queues

    // Dead Letter Queue for Match Queue
    const matchDLQ = new sqs.Queue(this, 'MatchQueueDLQ', {
      queueName: `beefmobile-match-queue-dlq-${environment}`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Match Queue (receives match.ready events)
    this.matchQueue = new sqs.Queue(this, 'MatchQueue', {
      queueName: `beefmobile-match-queue-${environment}`,
      visibilityTimeout: cdk.Duration.seconds(60),
      receiveMessageWaitTime: cdk.Duration.seconds(20), // Long polling
      deadLetterQueue: {
        queue: matchDLQ,
        maxReceiveCount: 3,
      },
    });

    // Subscribe Match Queue to Matchmaking Topic
    this.matchmakingTopic.addSubscription(
      new subscriptions.SqsSubscription(this.matchQueue, {
        rawMessageDelivery: false,
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ['matchmaking.match.ready'],
          }),
        },
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'MatchmakingTopicArn', {
      value: this.matchmakingTopic.topicArn,
      exportName: `MatchmakingTopicArn-${environment}`,
    });

    new cdk.CfnOutput(this, 'GameEventsTopicArn', {
      value: this.gameEventsTopic.topicArn,
      exportName: `GameEventsTopicArn-${environment}`,
    });

    new cdk.CfnOutput(this, 'MatchQueueUrl', {
      value: this.matchQueue.queueUrl,
      exportName: `MatchQueueUrl-${environment}`,
    });
  }
}
