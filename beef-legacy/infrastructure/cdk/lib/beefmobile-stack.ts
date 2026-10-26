import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { NetworkingStack } from './stacks/networking-stack';
import { DataStack } from './stacks/data-stack';
import { MessagingStack } from './stacks/messaging-stack';
import { ComputeStack } from './stacks/compute-stack';

export interface BeefmobileStackProps extends cdk.StackProps {
  environment: string;
}

export class BeefmobileStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BeefmobileStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // 1. Networking Layer - VPC, Subnets, Security Groups
    const networking = new NetworkingStack(this, 'Networking', {
      environment,
    });

    // 2. Data Layer - RDS, DynamoDB, ElastiCache, S3
    const data = new DataStack(this, 'Data', {
      environment,
      vpc: networking.vpc,
    });

    // 3. Messaging Layer - SNS, SQS, EventBridge
    const messaging = new MessagingStack(this, 'Messaging', {
      environment,
    });

    // 4. Compute Layer - ECS, Lambda, ALB
    const compute = new ComputeStack(this, 'Compute', {
      environment,
      vpc: networking.vpc,
      redis: data.redis,
      matchmakingTopic: messaging.matchmakingTopic,
      matchQueue: messaging.matchQueue,
      gameEventsTopic: messaging.gameEventsTopic,
      gameSessionsTable: data.gameSessionsTable,
      gameActionsTable: data.gameActionsTable,
      replaysBucket: data.replaysBucket,
    });

    // Outputs
    new cdk.CfnOutput(this, 'MatchmakingServiceUrl', {
      value: compute.matchmakingUrl,
      description: 'Matchmaking Service URL',
    });

    new cdk.CfnOutput(this, 'GameEngineServiceUrl', {
      value: compute.gameEngineUrl,
      description: 'Game Engine Service URL',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: data.redis.attrRedisEndpointAddress,
      description: 'Redis Cluster Endpoint',
    });
  }
}
