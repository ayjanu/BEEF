# Beefmobile Infrastructure (AWS CDK)

AWS Cloud Development Kit (CDK) infrastructure for the Beefmobile gaming platform.

## Overview

This CDK application provisions all AWS resources needed to run the Beefmobile platform:

- **Networking**: VPC, subnets, security groups, VPC endpoints
- **Data**: DynamoDB tables, ElastiCache Redis, S3 buckets
- **Messaging**: SNS topics, SQS queues
- **Compute**: ECS Fargate services, ECR repositories, Application Load Balancer

## Prerequisites

- AWS CLI configured with credentials
- Node.js 18+
- AWS CDK CLI: `npm install -g aws-cdk`
- Docker (for building container images)

## Quick Start

### 1. Install Dependencies

```bash
cd infrastructure/cdk
npm install
```

### 2. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 3. Deploy to Development

```bash
npm run deploy:dev
```

### 4. Deploy to Production

```bash
npm run deploy:prod
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    VPC                               │
│  ┌──────────────┐  ┌──────────────┐                │
│  │   Public     │  │   Private    │                │
│  │   Subnets    │  │   Subnets    │                │
│  │              │  │              │                │
│  │  ┌────────┐  │  │  ┌────────┐  │                │
│  │  │  ALB   │──┼──┼─▶│  ECS   │  │                │
│  │  └────────┘  │  │  │Fargate │  │                │
│  │              │  │  └────┬───┘  │                │
│  └──────────────┘  └───────┼──────┘                │
│                            │                        │
│                    ┌───────┼───────┐                │
│                    │       ▼       │                │
│               ┌────────┐  ┌────────┐               │
│               │ Redis  │  │RDS/    │               │
│               │        │  │DynamoDB│               │
│               └────────┘  └────────┘               │
└─────────────────────────────────────────────────────┘
                    │       │
                    ▼       ▼
            ┌───────────────────────┐
            │   SNS/SQS/S3          │
            │   (Messaging & Storage)│
            └───────────────────────┘
```

## Stack Structure

### Main Stack
- `BeefmobileStack`: Orchestrates all nested stacks

### Nested Stacks

#### 1. Networking Stack
- VPC with 3 AZs
- Public, Private, and Isolated subnets
- NAT Gateways
- VPC Endpoints (ECR, S3, DynamoDB)
- Security Groups for ALB, ECS, RDS, Redis

#### 2. Data Stack
- **DynamoDB Tables**:
  - `game-sessions`: Active game sessions
  - `game-actions`: Player actions log
- **ElastiCache Redis**: Matchmaking queues and session cache
- **S3 Buckets**: Game replays with Glacier lifecycle

#### 3. Messaging Stack
- **SNS Topics**:
  - `matchmaking-events`: Match lifecycle events
  - `game-events`: Game lifecycle events
- **SQS Queues**:
  - `match-queue`: Receives match.ready events
  - Dead letter queues for error handling

#### 4. Compute Stack
- **ECS Fargate**:
  - Matchmaking Service (Go)
  - Game Engine Service (Node.js)
- **ECR Repositories**: Container image storage
- **Application Load Balancer**: HTTP/HTTPS traffic routing
- **Auto Scaling**: CPU-based scaling policies
- **CloudWatch Logs**: Centralized logging

## Configuration

### Environment Variables

Set these in your shell or CI/CD pipeline:

```bash
export CDK_DEFAULT_ACCOUNT=123456789012
export CDK_DEFAULT_REGION=us-east-1
```

### Context Values

Environments are configured via CDK context:

- **Development**: `npm run deploy:dev`
- **Production**: `npm run deploy:prod`

Environment-specific settings:
- **Prod**: Multi-AZ, auto-scaling, enhanced monitoring
- **Dev**: Single-AZ, minimal capacity, cost-optimized

## Common Commands

```bash
# Synthesize CloudFormation template
npm run synth

# Show differences between deployed and local
npm run diff

# Deploy all stacks
npm run deploy

# Deploy specific environment
npm run deploy:dev
npm run deploy:prod

# Destroy all stacks
npm run destroy
```

## Deployment Process

### Initial Deployment

1. **Deploy Infrastructure**:
   ```bash
   npm run deploy:dev
   ```

2. **Build and Push Container Images**:
   ```bash
   # Get ECR URIs from CDK outputs
   MATCHMAKING_REPO=$(aws cloudformation describe-stacks \
     --stack-name BeefmobileStack-dev \
     --query "Stacks[0].Outputs[?ExportName=='MatchmakingECRRepo-dev'].OutputValue" \
     --output text)

   GAME_ENGINE_REPO=$(aws cloudformation describe-stacks \
     --stack-name BeefmobileStack-dev \
     --query "Stacks[0].Outputs[?ExportName=='GameEngineECRRepo-dev'].OutputValue" \
     --output text)

   # Login to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin $MATCHMAKING_REPO

   # Build and push Matchmaking
   cd services/matchmaking
   docker build -t $MATCHMAKING_REPO:latest .
   docker push $MATCHMAKING_REPO:latest

   # Build and push Game Engine
   cd ../game-engine
   docker build -t $GAME_ENGINE_REPO:latest .
   docker push $GAME_ENGINE_REPO:latest
   ```

3. **Update ECS Services**:
   ```bash
   aws ecs update-service \
     --cluster beefmobile-cluster-dev \
     --service matchmaking-dev \
     --force-new-deployment

   aws ecs update-service \
     --cluster beefmobile-cluster-dev \
     --service game-engine-dev \
     --force-new-deployment
   ```

### Continuous Deployment

Use GitHub Actions (see `.github/workflows/`) for automated deployments.

## Cost Optimization

### Development Environment
- Single NAT Gateway
- t3.micro Redis instance
- ECS Fargate Spot (optional)
- Single task per service
- 7-day log retention

### Production Environment
- Multi-AZ NAT Gateways
- r6g.large Redis with replication
- Reserved Capacity (Fargate Savings Plan)
- Multi-task deployment with auto-scaling
- 30-day log retention

### General Optimizations
- VPC Endpoints reduce NAT Gateway costs
- DynamoDB on-demand pricing
- S3 Glacier lifecycle for replays
- CloudWatch log retention policies

## Monitoring

### CloudWatch Dashboards

Create custom dashboards for:
- ECS task CPU/Memory
- ALB request count and latency
- DynamoDB throttles
- Redis CPU utilization

### Alarms

Recommended alarms:
- ECS task health check failures
- ALB 5xx error rate > threshold
- DynamoDB throttled requests
- Redis memory usage > 80%

## Security

### IAM Least Privilege
- Task roles have minimal permissions
- No wildcard permissions
- Service-specific policies

### Network Security
- Private subnets for compute and data
- Security groups with explicit rules
- VPC Flow Logs (optional, for debugging)

### Encryption
- DynamoDB: AWS-managed encryption
- S3: Server-side encryption
- ECS task secrets via Secrets Manager (optional)

## Troubleshooting

### Service Not Starting
1. Check CloudWatch Logs: `/aws/ecs/matchmaking` or `/aws/ecs/game-engine`
2. Verify environment variables in task definition
3. Check security group rules

### Cannot Connect to Redis
1. Ensure ECS tasks in private subnet
2. Verify security group allows port 6379
3. Check Redis endpoint in environment variables

### Image Pull Errors
1. Verify ECR repository exists
2. Check task execution role has ECR permissions
3. Ensure image is tagged correctly

## Cleanup

To destroy all resources:

```bash
# WARNING: This will delete all data!
npm run destroy
```

Or destroy specific environment:

```bash
cdk destroy BeefmobileStack-dev
```

## Future Enhancements

- [ ] Add Cognito User Pools for authentication
- [ ] Add RDS PostgreSQL for user profiles
- [ ] Add CloudFront CDN for static assets
- [ ] Add WAF for API protection
- [ ] Add X-Ray for distributed tracing
- [ ] Add EKS as alternative to ECS (optional)
- [ ] Add multi-region deployment

## Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [ECS Fargate Pricing](https://aws.amazon.com/fargate/pricing/)
- [DynamoDB Pricing](https://aws.amazon.com/dynamodb/pricing/)
- [ElastiCache Pricing](https://aws.amazon.com/elasticache/pricing/)

## Support

For issues, see main repository README or raise an issue on GitHub.
