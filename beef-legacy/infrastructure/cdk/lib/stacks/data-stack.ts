import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface DataStackProps {
  environment: string;
  vpc: ec2.Vpc;
}

export class DataStack extends Construct {
  public readonly gameSessionsTable: dynamodb.Table;
  public readonly gameActionsTable: dynamodb.Table;
  public readonly replaysBucket: s3.Bucket;
  public readonly redis: elasticache.CfnCacheCluster;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id);

    const { environment, vpc } = props;

    // DynamoDB Tables

    // Game Sessions Table
    this.gameSessionsTable = new dynamodb.Table(this, 'GameSessionsTable', {
      tableName: `beefmobile-game-sessions-${environment}`,
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      pointInTimeRecovery: environment === 'prod',
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
    });

    // GSI for querying by matchId
    this.gameSessionsTable.addGlobalSecondaryIndex({
      indexName: 'matchId-index',
      partitionKey: {
        name: 'matchId',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Game Actions Table
    this.gameActionsTable = new dynamodb.Table(this, 'GameActionsTable', {
      tableName: `beefmobile-game-actions-${environment}`,
      partitionKey: {
        name: 'sessionId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'actionId',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl',
    });

    // ElastiCache Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Redis cluster',
      subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
      cacheSubnetGroupName: `beefmobile-redis-subnet-${environment}`,
    });

    this.redis = new elasticache.CfnCacheCluster(this, 'RedisCluster', {
      cacheNodeType: environment === 'prod' ? 'cache.r6g.large' : 'cache.t3.micro',
      engine: 'redis',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      vpcSecurityGroupIds: [
        cdk.Fn.getAtt('Networking/RedisSecurityGroup', 'GroupId').toString(),
      ],
      engineVersion: '7.0',
      port: 6379,
      clusterName: `beefmobile-redis-${environment}`,
      autoMinorVersionUpgrade: true,
      preferredMaintenanceWindow: 'sun:05:00-sun:07:00',
    });

    this.redis.addDependency(redisSubnetGroup);

    // S3 Bucket for Replays
    this.replaysBucket = new s3.Bucket(this, 'ReplaysBucket', {
      bucketName: `beefmobile-replays-${environment}-${cdk.Stack.of(this).account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          id: 'MoveToGlacier',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'GameSessionsTableName', {
      value: this.gameSessionsTable.tableName,
      exportName: `GameSessionsTable-${environment}`,
    });

    new cdk.CfnOutput(this, 'GameActionsTableName', {
      value: this.gameActionsTable.tableName,
      exportName: `GameActionsTable-${environment}`,
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: this.redis.attrRedisEndpointAddress,
      exportName: `RedisEndpoint-${environment}`,
    });

    new cdk.CfnOutput(this, 'ReplaysBucketName', {
      value: this.replaysBucket.bucketName,
      exportName: `ReplaysBucket-${environment}`,
    });
  }
}
