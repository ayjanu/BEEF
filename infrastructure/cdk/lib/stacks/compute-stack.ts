import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { Construct } from 'constructs';

export interface ComputeStackProps {
  environment: string;
  vpc: ec2.Vpc;
  redis: elasticache.CfnCacheCluster;
  matchmakingTopic: sns.Topic;
  matchQueue: sqs.Queue;
  gameEventsTopic: sns.Topic;
  gameSessionsTable: dynamodb.Table;
  gameActionsTable: dynamodb.Table;
  replaysBucket: s3.Bucket;
}

export class ComputeStack extends Construct {
  public readonly matchmakingUrl: string;
  public readonly gameEngineUrl: string;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id);

    const {
      environment,
      vpc,
      redis,
      matchmakingTopic,
      matchQueue,
      gameEventsTopic,
      gameSessionsTable,
      gameActionsTable,
      replaysBucket,
    } = props;

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      clusterName: `beefmobile-cluster-${environment}`,
      containerInsights: environment === 'prod',
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `beefmobile-alb-${environment}`,
    });

    // ========================================================================
    // Matchmaking Service
    // ========================================================================

    // ECR Repository for Matchmaking
    const matchmakingRepo = new ecr.Repository(this, 'MatchmakingRepo', {
      repositoryName: `beefmobile/matchmaking-${environment}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
    });

    // Task Definition
    const matchmakingTaskDef = new ecs.FargateTaskDefinition(this, 'MatchmakingTaskDef', {
      memoryLimitMiB: 512,
      cpu: 256,
      family: `matchmaking-${environment}`,
    });

    // Task Role Permissions
    matchmakingTaskDef.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
    );
    matchmakingTopic.grantPublish(matchmakingTaskDef.taskRole);

    // Container
    const matchmakingContainer = matchmakingTaskDef.addContainer('matchmaking', {
      image: ecs.ContainerImage.fromEcrRepository(matchmakingRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'matchmaking',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        ENV: environment,
        PORT: '8080',
        REDIS_HOST: redis.attrRedisEndpointAddress,
        REDIS_PORT: '6379',
        AWS_REGION: cdk.Stack.of(this).region,
        AWS_SNS_TOPIC_ARN: matchmakingTopic.topicArn,
        LOG_LEVEL: 'info',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    matchmakingContainer.addPortMappings({
      containerPort: 8080,
      protocol: ecs.Protocol.TCP,
    });

    // Fargate Service
    const matchmakingService = new ecs.FargateService(this, 'MatchmakingService', {
      cluster,
      taskDefinition: matchmakingTaskDef,
      serviceName: `matchmaking-${environment}`,
      desiredCount: environment === 'prod' ? 2 : 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Target Group
    const matchmakingTG = new elbv2.ApplicationTargetGroup(this, 'MatchmakingTG', {
      vpc,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    matchmakingService.attachToApplicationTargetGroup(matchmakingTG);

    // ALB Listener for Matchmaking
    const matchmakingListener = alb.addListener('MatchmakingListener', {
      port: 80,
      open: true,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Not Found',
      }),
    });

    matchmakingListener.addTargetGroups('MatchmakingTGs', {
      targetGroups: [matchmakingTG],
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/v1/matchmaking/*', '/health']),
      ],
      priority: 10,
    });

    // Auto Scaling
    const matchmakingScaling = matchmakingService.autoScaleTaskCount({
      minCapacity: environment === 'prod' ? 2 : 1,
      maxCapacity: environment === 'prod' ? 10 : 3,
    });

    matchmakingScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // ========================================================================
    // Game Engine Service
    // ========================================================================

    // ECR Repository for Game Engine
    const gameEngineRepo = new ecr.Repository(this, 'GameEngineRepo', {
      repositoryName: `beefmobile/game-engine-${environment}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
    });

    // Task Definition
    const gameEngineTaskDef = new ecs.FargateTaskDefinition(this, 'GameEngineTaskDef', {
      memoryLimitMiB: 1024,
      cpu: 512,
      family: `game-engine-${environment}`,
    });

    // Task Role Permissions
    gameEngineTaskDef.taskRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchLogsFullAccess')
    );
    gameEventsTopic.grantPublish(gameEngineTaskDef.taskRole);
    matchQueue.grantConsumeMessages(gameEngineTaskDef.taskRole);
    gameSessionsTable.grantReadWriteData(gameEngineTaskDef.taskRole);
    gameActionsTable.grantReadWriteData(gameEngineTaskDef.taskRole);
    replaysBucket.grantReadWrite(gameEngineTaskDef.taskRole);

    // Container
    const gameEngineContainer = gameEngineTaskDef.addContainer('game-engine', {
      image: ecs.ContainerImage.fromEcrRepository(gameEngineRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'game-engine',
        logRetention: logs.RetentionDays.ONE_WEEK,
      }),
      environment: {
        NODE_ENV: environment === 'prod' ? 'production' : 'development',
        PORT: '8081',
        AWS_REGION: cdk.Stack.of(this).region,
        DYNAMODB_GAME_SESSIONS_TABLE: gameSessionsTable.tableName,
        DYNAMODB_GAME_ACTIONS_TABLE: gameActionsTable.tableName,
        S3_REPLAYS_BUCKET: replaysBucket.bucketName,
        SQS_MATCH_QUEUE_URL: matchQueue.queueUrl,
        SNS_GAME_EVENTS_TOPIC_ARN: gameEventsTopic.topicArn,
        LOG_LEVEL: 'info',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'wget --no-verbose --tries=1 --spider http://localhost:8081/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    gameEngineContainer.addPortMappings({
      containerPort: 8081,
      protocol: ecs.Protocol.TCP,
    });

    // Fargate Service
    const gameEngineService = new ecs.FargateService(this, 'GameEngineService', {
      cluster,
      taskDefinition: gameEngineTaskDef,
      serviceName: `game-engine-${environment}`,
      desiredCount: environment === 'prod' ? 2 : 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
    });

    // Target Group
    const gameEngineTG = new elbv2.ApplicationTargetGroup(this, 'GameEngineTG', {
      vpc,
      port: 8081,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
      stickiness: {
        enabled: true, // For WebSocket connections
        duration: cdk.Duration.hours(1),
      },
    });

    gameEngineService.attachToApplicationTargetGroup(gameEngineTG);

    // ALB Listener for Game Engine
    matchmakingListener.addTargetGroups('GameEngineTGs', {
      targetGroups: [gameEngineTG],
      conditions: [
        elbv2.ListenerCondition.pathPatterns(['/v1/game/*']),
      ],
      priority: 20,
    });

    // Auto Scaling
    const gameEngineScaling = gameEngineService.autoScaleTaskCount({
      minCapacity: environment === 'prod' ? 2 : 1,
      maxCapacity: environment === 'prod' ? 20 : 5,
    });

    gameEngineScaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Store URLs
    this.matchmakingUrl = `http://${alb.loadBalancerDnsName}`;
    this.gameEngineUrl = `http://${alb.loadBalancerDnsName}`;

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      exportName: `LoadBalancerDNS-${environment}`,
    });

    new cdk.CfnOutput(this, 'MatchmakingECRRepo', {
      value: matchmakingRepo.repositoryUri,
      exportName: `MatchmakingECRRepo-${environment}`,
    });

    new cdk.CfnOutput(this, 'GameEngineECRRepo', {
      value: gameEngineRepo.repositoryUri,
      exportName: `GameEngineECRRepo-${environment}`,
    });
  }
}
