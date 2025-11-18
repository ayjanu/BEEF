# Deployment Guide

Complete deployment guide for the Beefmobile gaming platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [AWS Deployment](#aws-deployment)
4. [CI/CD Setup](#cicd-setup)
5. [Monitoring & Operations](#monitoring--operations)
6. [Troubleshooting](#troubleshooting)

## Prerequisites

### Tools Required

- **AWS CLI** v2.x: `aws --version`
- **AWS CDK** v2.x: `npm install -g aws-cdk`
- **Docker** 20.x+: `docker --version`
- **Node.js** 18+: `node --version`
- **Go** 1.21+: `go version`
- **Git**: `git --version`

### AWS Account Setup

1. **Create AWS Account** (if not exists)
2. **Configure AWS CLI**:
   ```bash
   aws configure
   ```
3. **Set up IAM User/Role** with permissions:
   - EC2, VPC, ECS, ECR
   - DynamoDB, S3, ElastiCache
   - SNS, SQS, CloudFormation
   - IAM, CloudWatch

## Local Development

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/beefmobile.git
cd beefmobile
```

### 2. Start Local Services

Using Docker Compose:

```bash
docker-compose up -d
```

This starts:
- Redis (port 6379)
- LocalStack (AWS services mock, port 4566)
- Matchmaking Service (port 8080)
- Game Engine Service (port 8081)

### 3. Initialize LocalStack Resources

```bash
# Create SNS topics
aws --endpoint-url=http://localhost:4566 sns create-topic \
  --name matchmaking-events

aws --endpoint-url=http://localhost:4566 sns create-topic \
  --name game-events

# Create SQS queue
aws --endpoint-url=http://localhost:4566 sqs create-queue \
  --queue-name match-queue

# Create DynamoDB tables
aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name game-sessions-dev \
  --attribute-definitions AttributeName=sessionId,AttributeType=S \
  --key-schema AttributeName=sessionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws --endpoint-url=http://localhost:4566 dynamodb create-table \
  --table-name game-actions-dev \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=actionId,AttributeType=S \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
    AttributeName=actionId,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST
```

### 4. Verify Services

```bash
# Matchmaking health check
curl http://localhost:8080/health

# Game Engine health check
curl http://localhost:8081/health
```

### 5. Run Services Locally (Alternative)

Without Docker:

**Matchmaking Service:**
```bash
cd services/matchmaking
cp .env.example .env
# Edit .env with local settings
make run
```

**Game Engine Service:**
```bash
cd services/game-engine
cp .env.example .env
# Edit .env with local settings
npm install
npm run dev
```

## AWS Deployment

### Step 1: Bootstrap CDK

First-time setup per AWS account/region:

```bash
cd infrastructure/cdk
npm install

# Bootstrap CDK
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### Step 2: Deploy Infrastructure (Development)

```bash
# Build infrastructure
npm run build

# Preview changes
npm run diff

# Deploy to dev environment
npm run deploy:dev
```

This creates:
- VPC with public/private subnets
- ECS Fargate cluster
- ALB for routing
- DynamoDB tables
- ElastiCache Redis
- SNS topics and SQS queues
- ECR repositories
- CloudWatch log groups

**Note:** Initial deployment takes ~15-20 minutes.

### Step 3: Build and Push Container Images

After infrastructure deployment:

```bash
# Get ECR repository URIs from CDK outputs
export MATCHMAKING_REPO=$(aws cloudformation describe-stacks \
  --stack-name BeefmobileStack-dev \
  --query "Stacks[0].Outputs[?ExportName=='MatchmakingECRRepo-dev'].OutputValue" \
  --output text)

export GAME_ENGINE_REPO=$(aws cloudformation describe-stacks \
  --stack-name BeefmobileStack-dev \
  --query "Stacks[0].Outputs[?ExportName=='GameEngineECRRepo-dev'].OutputValue" \
  --output text)

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $(echo $MATCHMAKING_REPO | cut -d/ -f1)

# Build and push Matchmaking
cd services/matchmaking
docker build -t $MATCHMAKING_REPO:latest .
docker push $MATCHMAKING_REPO:latest

# Build and push Game Engine
cd ../game-engine
docker build -t $GAME_ENGINE_REPO:latest .
docker push $GAME_ENGINE_REPO:latest
```

### Step 4: Deploy ECS Services

```bash
# Update Matchmaking service
aws ecs update-service \
  --cluster beefmobile-cluster-dev \
  --service matchmaking-dev \
  --force-new-deployment

# Update Game Engine service
aws ecs update-service \
  --cluster beefmobile-cluster-dev \
  --service game-engine-dev \
  --force-new-deployment

# Wait for deployments to complete
aws ecs wait services-stable \
  --cluster beefmobile-cluster-dev \
  --services matchmaking-dev game-engine-dev
```

### Step 5: Verify Deployment

```bash
# Get ALB URL
export ALB_URL=$(aws cloudformation describe-stacks \
  --stack-name BeefmobileStack-dev \
  --query "Stacks[0].Outputs[?OutputKey=='LoadBalancerDNS'].OutputValue" \
  --output text)

# Test Matchmaking
curl http://$ALB_URL/health

# Test Game Engine
curl http://$ALB_URL/v1/game/sessions/active
```

### Production Deployment

For production, use the `prod` environment:

```bash
cd infrastructure/cdk
npm run deploy:prod
```

**Key differences in production:**
- Multi-AZ deployment (3 AZs)
- Multiple NAT Gateways
- Larger instance types
- Auto-scaling enabled
- Enhanced monitoring
- Point-in-time recovery enabled

## CI/CD Setup

### GitHub Actions (Recommended)

#### 1. Configure GitHub Secrets

Add the following secrets in your GitHub repository settings:

- `AWS_ROLE_ARN`: IAM role ARN for dev deployments
- `AWS_PROD_ROLE_ARN`: IAM role ARN for prod deployments

#### 2. Set Up OIDC Provider (Recommended)

Create an OIDC provider in AWS IAM to allow GitHub Actions to assume roles without storing credentials.

**Create Trust Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:yourusername/beefmobile:*"
        }
      }
    }
  ]
}
```

#### 3. Workflows

Three workflows are provided:

**`.github/workflows/ci.yml`**: Runs on all PRs
- Lints and tests all services
- Builds Docker images
- Synths CDK infrastructure

**`.github/workflows/deploy-dev.yml`**: Deploys to dev
- Triggered on push to `develop` branch
- Builds and pushes images to ECR
- Deploys infrastructure
- Updates ECS services

**`.github/workflows/deploy-prod.yml`**: Deploys to prod
- Triggered on push to `main` branch or version tags
- Rolling update strategy
- Smoke tests after deployment

### Manual CI/CD Alternative

Use the provided Makefiles for manual deployments:

```bash
# Build all services
make -C services/matchmaking build
make -C services/game-engine build

# Run tests
make -C services/matchmaking test
make -C services/game-engine test

# Deploy
cd infrastructure/cdk
npm run deploy:dev
```

## Monitoring & Operations

### CloudWatch Logs

View logs:

```bash
# Matchmaking logs
aws logs tail /aws/ecs/matchmaking --follow

# Game Engine logs
aws logs tail /aws/ecs/game-engine --follow
```

### CloudWatch Metrics

Key metrics to monitor:

- **ECS**: CPUUtilization, MemoryUtilization
- **ALB**: TargetResponseTime, HTTPCode_Target_5XX_Count
- **DynamoDB**: ConsumedReadCapacityUnits, ConsumedWriteCapacityUnits
- **ElastiCache**: CPUUtilization, DatabaseMemoryUsagePercentage

### Alarms

Create CloudWatch alarms:

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name matchmaking-high-cpu \
  --alarm-description "Matchmaking CPU > 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Scaling

**Manual scaling:**
```bash
aws ecs update-service \
  --cluster beefmobile-cluster-dev \
  --service matchmaking-dev \
  --desired-count 4
```

**Auto-scaling** is configured in CDK based on CPU utilization (70% target).

## Troubleshooting

### Service Not Starting

1. **Check CloudWatch Logs:**
   ```bash
   aws logs tail /aws/ecs/matchmaking --follow
   ```

2. **Check ECS Task Status:**
   ```bash
   aws ecs describe-services \
     --cluster beefmobile-cluster-dev \
     --services matchmaking-dev
   ```

3. **Common Issues:**
   - Image pull errors: Verify ECR permissions
   - Environment variable errors: Check task definition
   - Health check failures: Verify application is listening on correct port

### Cannot Connect to Services

1. **Security Groups:** Ensure ALB security group allows inbound on port 80/443
2. **Target Health:** Check target group health in ALB console
3. **Service Discovery:** Verify ECS service is registered with target group

### Redis Connection Issues

1. **Security Group:** Verify ECS security group can access Redis
2. **Endpoint:** Check Redis endpoint in environment variables
3. **Network:** Ensure both are in the same VPC

### DynamoDB Throttling

1. **Check Consumed Capacity:** View CloudWatch metrics
2. **Switch to On-Demand:** If unpredictable traffic patterns
3. **Increase Provisioned Capacity:** If using provisioned mode

### Cost Optimization

1. **Use Fargate Spot:** For non-critical workloads
2. **Right-size Tasks:** Monitor and adjust CPU/memory
3. **Use Reserved Capacity:** For predictable production workloads
4. **Enable Container Insights Selectively:** Only in production
5. **Set Log Retention:** Don't keep logs indefinitely

## Rolling Back

### Rollback ECS Service

```bash
aws ecs update-service \
  --cluster beefmobile-cluster-dev \
  --service matchmaking-dev \
  --task-definition matchmaking-dev:PREVIOUS_REVISION
```

### Rollback Infrastructure

```bash
cd infrastructure/cdk
git checkout PREVIOUS_COMMIT
npm run deploy:dev
```

## Cleanup

To delete all resources:

```bash
cd infrastructure/cdk
npm run destroy
```

**Warning:** This deletes all data. Ensure backups are taken first.

## Next Steps

1. Set up custom domain with Route53
2. Configure SSL/TLS certificates
3. Implement WAF rules
4. Set up monitoring dashboards
5. Configure alerting (PagerDuty/Slack)
6. Implement backup strategy
7. Document runbooks for common operations
