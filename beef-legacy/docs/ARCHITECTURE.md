# Beefmobile Architecture

## Overview
Real-time social gaming and communication platform built on AWS, demonstrating Solutions Architect Professional level design principles.

## Architecture Principles
- **Serverless-First**: Leverage managed services to reduce operational overhead
- **Microservices**: Independent, scalable services with clear boundaries
- **Event-Driven**: Asynchronous communication via SQS, SNS, EventBridge, Kinesis
- **Multi-Region Ready**: Design for global scale with regional isolation
- **Cost-Optimized**: Right-sized resources with auto-scaling and lifecycle policies

## High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│              React Web App + React Native Mobile                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  REST APIs   │  │  GraphQL     │  │  WebSocket   │          │
│  │ (API Gateway)│  │  (AppSync)   │  │ (API Gateway)│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────┬────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Auth Service │  │ Matchmaking  │  │ Game Engine  │
│   (NestJS)   │  │    (Go)      │  │   (Node.js)  │
│   Cognito    │  │  ECS Fargate │  │ ECS Fargate  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                       Data Layer                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   RDS    │  │ DynamoDB │  │  Redis   │  │    S3    │        │
│  │PostgreSQL│  │  (Chat)  │  │(Sessions)│  │  (Media) │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────────────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Event & Streaming Layer                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Kinesis  │  │   SQS    │  │   SNS    │  │EventBridge│        │
│  │ Streams  │  │  Queues  │  │  Topics  │  │   Bus    │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

## Core Services

### 1. Matchmaking Service (Priority - Phase 1)
**Technology**: Go
**Infrastructure**: ECS Fargate
**Purpose**: Pairs players for multiplayer games using skill-based matchmaking

**Key Components**:
- Redis-based queue management with region partitioning
- ELO/MMR rating system
- WebSocket notifications for queue status
- Integration with Game Engine via SNS/SQS

**AWS Services**:
- ECS Fargate for compute
- ElastiCache (Redis) for queue state
- Application Load Balancer
- CloudWatch for metrics
- SNS for match notifications

**API Endpoints**:
- `POST /matchmaking/queue/join` - Join matchmaking queue
- `DELETE /matchmaking/queue/leave` - Leave queue
- `GET /matchmaking/queue/status` - Get queue position
- `GET /matchmaking/history` - Match history

### 2. Game Engine Service (Priority - Phase 1)
**Technology**: Node.js (TypeScript)
**Infrastructure**: ECS Fargate
**Purpose**: Executes game logic in real-time, maintains game state

**Key Components**:
- Stateless game workers with deterministic seed-based logic
- State synchronization via AppSync WebSockets
- Game session management with DynamoDB
- Result persistence to RDS

**AWS Services**:
- ECS Fargate for game instances
- AppSync for real-time WebSocket updates
- DynamoDB for active game state
- RDS for historical game data
- S3 for game replays

**API Endpoints**:
- `POST /game/session/start` - Initialize game session
- `POST /game/action` - Submit player action
- `GET /game/state/:sessionId` - Get current game state
- `POST /game/session/end` - End game session
- `GET /game/replay/:sessionId` - Get replay data

### 3. Authentication & Profiles Service (Future Phase)
**Technology**: NestJS
**Infrastructure**: ECS Fargate + Lambda
**Purpose**: User authentication, authorization, profile management

**AWS Services**:
- Cognito User Pools
- RDS (PostgreSQL) for profiles
- ElastiCache for session caching
- Secrets Manager for keys

### 4. Chat & Presence Service (Future Phase)
**Technology**: Node.js + Socket.IO or Elixir
**Infrastructure**: ECS Fargate
**Purpose**: Real-time messaging and user presence

**AWS Services**:
- API Gateway WebSocket
- DynamoDB for message storage
- ElastiCache (Redis) for presence
- SQS for moderation queue

### 5. Media & Streaming Service (Future Phase)
**Technology**: Python + FastAPI
**Infrastructure**: Lambda + ECS
**Purpose**: Video streaming, upload, and CDN delivery

**AWS Services**:
- Amazon IVS (Interactive Video Service)
- S3 with Glacier lifecycle
- CloudFront CDN
- MediaConvert for transcoding
- OpenSearch for metadata

### 6. Moderation Service (Future Phase)
**Technology**: Python FastAPI
**Infrastructure**: Lambda + SageMaker
**Purpose**: Content moderation using ML models

**AWS Services**:
- SageMaker (Hugging Face models)
- Rekognition (image moderation)
- Comprehend (text analysis)
- SQS for async processing
- DynamoDB for decisions

### 7. Payments Service (Future Phase)
**Technology**: Node.js
**Infrastructure**: Lambda
**Purpose**: Stripe integration for subscriptions

**AWS Services**:
- Lambda for webhook handlers
- Secrets Manager for API keys
- RDS for transaction ledger
- EventBridge for payment events

### 8. Analytics Service (Future Phase)
**Purpose**: User engagement tracking and business analytics

**AWS Services**:
- Amazon Pinpoint
- Kinesis Firehose
- OpenSearch or Snowflake
- QuickSight for dashboards

## Data Flow Example: Complete Game Session

1. **User Authentication**
   - User logs in → Cognito validates → JWT token issued
   - Profile loaded from RDS, cached in Redis

2. **Matchmaking**
   - User clicks "Find Match" → Frontend calls Matchmaking Service
   - User added to Redis queue with MMR score
   - Matchmaking algorithm runs every 2s, pairs compatible players
   - Match found → SNS publishes `MatchReady` event

3. **Game Initialization**
   - Game Engine Service receives `MatchReady` from SQS
   - Creates game session in DynamoDB
   - Establishes AppSync WebSocket connections
   - Generates deterministic game seed
   - Emits `GameStarted` event to players

4. **Gameplay**
   - Player actions → REST API → Game Engine validates
   - State updates broadcast via AppSync WebSocket
   - All actions logged to DynamoDB stream
   - CloudWatch metrics track latency

5. **Game Completion**
   - Game ends → Results saved to RDS
   - MMR ratings updated in RDS
   - Replay data saved to S3
   - EventBridge triggers analytics pipeline
   - Kinesis Firehose streams to OpenSearch

6. **Post-Game**
   - Users can view stats, share highlights
   - Media uploaded to S3 → Moderation queue
   - CloudFront serves approved content

## Infrastructure Components

### Compute
- **ECS Fargate**: Stateful services (Matchmaking, Game Engine, Auth)
- **Lambda**: Event-driven tasks (webhooks, moderation, analytics)
- **EKS** (Optional): For advanced orchestration if needed

### Data Storage
- **RDS PostgreSQL**: User profiles, game history, transactions
- **DynamoDB**: Chat messages, active game sessions, queues
- **ElastiCache Redis**: Session cache, presence, matchmaking queues
- **S3**: Media files, game replays, backups
- **OpenSearch**: Search, feeds, analytics

### Networking
- **VPC**: Private subnets for services, public for ALB
- **ALB**: Load balancing for HTTP services
- **NLB**: Load balancing for WebSocket/TCP services
- **CloudFront**: CDN for static assets and media
- **Route53**: DNS management

### Security
- **Cognito**: User authentication
- **IAM**: Service roles and policies
- **Secrets Manager**: API keys and credentials
- **WAF**: API protection
- **Shield**: DDoS protection

### Observability
- **CloudWatch**: Logs, metrics, alarms
- **X-Ray**: Distributed tracing
- **OpenTelemetry**: Custom instrumentation
- **Prometheus + Grafana**: Advanced metrics
- **PagerDuty**: Incident management

### CI/CD
- **GitHub Actions**: Build and test
- **ECR**: Container registry
- **AWS CodePipeline** (optional): Deployment automation
- **ArgoCD** (optional): GitOps for EKS

## Security Considerations

1. **Authentication & Authorization**
   - Cognito User Pools with MFA
   - JWT validation in API Gateway
   - Fine-grained IAM policies

2. **Data Protection**
   - Encryption at rest (KMS)
   - Encryption in transit (TLS 1.3)
   - RDS automated backups
   - S3 versioning and lifecycle

3. **Network Security**
   - VPC with private subnets
   - Security groups with least privilege
   - WAF rules for common attacks
   - DDoS protection with Shield

4. **Compliance**
   - GDPR: Data portability, right to deletion
   - COPPA: Age verification for <13
   - PCI DSS: No card data storage (Stripe handles)

## Cost Optimization Strategies

1. **Compute**
   - Fargate Spot instances for non-critical workloads
   - Lambda for bursty/infrequent tasks
   - Auto-scaling based on demand

2. **Storage**
   - S3 Intelligent-Tiering
   - Glacier for old replays/backups
   - DynamoDB on-demand for variable traffic
   - RDS reserved instances for predictable load

3. **Networking**
   - CloudFront caching to reduce origin requests
   - VPC endpoints to avoid NAT gateway costs
   - Regional isolation to minimize cross-region transfer

4. **Monitoring**
   - CloudWatch Logs retention policies
   - Metric filters to reduce ingestion
   - Sample traces in X-Ray

## Scaling Considerations

### Vertical Scaling
- RDS read replicas for profile reads
- ElastiCache cluster mode for Redis
- DynamoDB auto-scaling

### Horizontal Scaling
- ECS task auto-scaling based on CPU/memory
- ALB with multiple AZs
- Multi-region deployment for global users

### Event-Driven Scaling
- SQS queue depth triggers
- Kinesis shard count adjustments
- Lambda concurrent execution limits

## Disaster Recovery

- **RTO (Recovery Time Objective)**: < 1 hour
- **RPO (Recovery Point Objective)**: < 15 minutes

**Strategies**:
- Multi-AZ deployments for RDS and ElastiCache
- S3 cross-region replication for critical media
- DynamoDB Point-in-Time Recovery
- Automated RDS snapshots
- Infrastructure as Code for rapid rebuild

## Phase 1 Deliverables (Current Focus)

1. Matchmaking Service (Go)
   - Complete service implementation
   - Docker configuration
   - Unit and integration tests

2. Game Engine Service (Node.js)
   - Complete service implementation
   - Docker configuration
   - Unit and integration tests

3. AWS CDK Infrastructure
   - VPC and networking
   - ECS clusters
   - RDS and ElastiCache
   - ALB and API Gateway
   - IAM roles and policies

4. CI/CD Pipeline
   - GitHub Actions workflows
   - ECR push and deploy
   - Environment management

5. Shared Libraries
   - TypeScript type definitions
   - API contracts (OpenAPI)
   - Common utilities

## Next Steps

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment instructions.
See [../services/README.md](../services/README.md) for service-specific documentation.
