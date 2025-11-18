# Beefmobile Gaming Platform

Real-time social gaming and communication platform built on AWS, demonstrating Solutions Architect Professional-level design and implementation.

## Overview

Beefmobile is a comprehensive gaming platform featuring:

- **Real-Time Multiplayer**: Skill-based matchmaking with low-latency gameplay
- **Social Features**: Chat, friends, presence tracking
- **Media Streaming**: Live streams and replay sharing
- **Content Moderation**: AI-powered safety systems
- **Analytics**: Player engagement and retention metrics
- **Monetization**: Subscriptions and in-game purchases

Built with a serverless-first, event-driven microservices architecture on AWS.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│              React Web + React Native Mobile                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  API Gateway Layer                           │
│   REST APIs    │    GraphQL    │    WebSocket               │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼──────────────────┐
        ▼                ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Matchmaking  │  │ Game Engine  │  │   Auth       │
│   (Go)       │  │  (Node.js)   │  │  (NestJS)    │
│ ECS Fargate  │  │ ECS Fargate  │  │ ECS Fargate  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                       Data Layer                             │
│  DynamoDB  │  Redis  │  RDS  │  S3  │  OpenSearch          │
└─────────────────────────────────────────────────────────────┘
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Repository Structure

```
beefmobile/
├── docs/                      # Documentation
│   ├── ARCHITECTURE.md        # System architecture
│   ├── DEPLOYMENT.md          # Deployment guide
│   └── ROADMAP.md             # Iterative delivery plan
├── frontend/                  # Frontend application
│   ├── src/                   # React source code
│   ├── package.json           # Frontend dependencies
│   └── vite.config.ts         # Vite configuration
├── services/                  # Backend microservices
│   ├── matchmaking/           # Matchmaking service (Go)
│   └── game-engine/           # Game engine service (Node.js)
├── infrastructure/            # Infrastructure as Code
│   └── cdk/                   # AWS CDK (TypeScript)
├── shared/                    # Shared libraries
│   ├── types/                 # TypeScript type definitions
│   └── contracts/             # API contracts (OpenAPI)
├── .github/                   # CI/CD workflows
│   └── workflows/
├── docker-compose.yml         # Local development environment
├── package.json               # Monorepo root configuration
└── README.md                  # This file
```

## Tech Stack

### Backend Services
- **Go** (Matchmaking): High-performance queue management
- **Node.js/TypeScript** (Game Engine): Real-time game logic
- **NestJS** (Future: Auth, Chat): Enterprise-grade Node.js framework
- **Python/FastAPI** (Future: Moderation, Media): ML model integration

### AWS Services
- **Compute**: ECS Fargate, Lambda
- **Networking**: VPC, ALB, API Gateway
- **Data**: DynamoDB, RDS PostgreSQL, ElastiCache Redis, S3
- **Messaging**: SNS, SQS, EventBridge
- **Streaming**: Amazon IVS, Kinesis
- **AI/ML**: SageMaker, Rekognition, Comprehend
- **Monitoring**: CloudWatch, X-Ray, OpenTelemetry
- **Security**: Cognito, Secrets Manager, WAF

### Frontend
- **React + Vite** (Web): Progressive web app
- **React Native + Expo** (Future Mobile): iOS and Android

## Quick Start

### Prerequisites

- Docker Desktop
- Node.js 18+
- Go 1.21+
- AWS CLI v2
- AWS CDK v2

### Local Development

1. **Clone repository**:
   ```bash
   git clone https://github.com/yourusername/beefmobile.git
   cd beefmobile
   ```

2. **Start frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Frontend runs at http://localhost:5173

3. **Start backend services with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

4. **Verify services**:
   ```bash
   curl http://localhost:8080/health  # Matchmaking
   curl http://localhost:8081/health  # Game Engine
   ```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed setup instructions.

### AWS Deployment

1. **Install dependencies**:
   ```bash
   cd infrastructure/cdk
   npm install
   ```

2. **Bootstrap CDK** (first time only):
   ```bash
   cdk bootstrap
   ```

3. **Deploy to development**:
   ```bash
   npm run deploy:dev
   ```

4. **Build and push container images**:
   ```bash
   # See deployment guide for detailed steps
   ```

Full deployment guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Current Status: Phase 1 (MVP)

Phase 1 focuses on core matchmaking and gameplay functionality.

**Completed**:
- [x] Project structure and monorepo setup
- [x] Matchmaking service implementation (Go)
- [x] Game engine service implementation (Node.js)
- [x] AWS CDK infrastructure (VPC, ECS, DynamoDB, Redis, SNS/SQS)
- [x] Shared types and API contracts
- [x] Docker containers and local development setup
- [x] CI/CD pipelines (GitHub Actions)
- [x] Comprehensive documentation

**In Progress**:
- [ ] Unit and integration tests
- [ ] AWS deployment and verification
- [ ] Load testing
- [ ] Frontend integration with backend services

**Next Steps** (Phase 2):
- Authentication service (Cognito + NestJS)
- User profiles and stats (RDS PostgreSQL)
- Profile caching (ElastiCache)

See [docs/ROADMAP.md](docs/ROADMAP.md) for the complete delivery plan.

## Services

### Matchmaking Service (Go)

Real-time matchmaking with MMR-based pairing.

**Features**:
- Redis-backed queue management
- Region-partitioned queues
- Configurable MMR tolerance
- SNS event publishing
- REST API

**Docs**: [services/matchmaking/README.md](services/matchmaking/README.md)

### Game Engine Service (Node.js)

Deterministic game logic with real-time synchronization.

**Features**:
- WebSocket communication (Socket.IO)
- Seed-based deterministic randomness
- Action validation and replay
- DynamoDB persistence
- SQS match consumer

**Docs**: [services/game-engine/README.md](services/game-engine/README.md)

## Infrastructure

AWS CDK infrastructure with nested stacks:

- **Networking**: VPC, subnets, security groups, VPC endpoints
- **Data**: DynamoDB tables, ElastiCache Redis, S3 buckets, RDS (future)
- **Messaging**: SNS topics, SQS queues
- **Compute**: ECS Fargate, ECR, Application Load Balancer

**Environment Support**:
- **Development**: Single-AZ, cost-optimized
- **Production**: Multi-AZ, auto-scaling, enhanced monitoring

**Docs**: [infrastructure/cdk/README.md](infrastructure/cdk/README.md)

## Development

### Running Tests

```bash
# Matchmaking service
cd services/matchmaking
make test

# Game Engine service
cd services/game-engine
npm test

# Infrastructure
cd infrastructure/cdk
npm test
```

### Building Services

```bash
# Matchmaking
cd services/matchmaking
make build

# Game Engine
cd services/game-engine
npm run build

# Infrastructure
cd infrastructure/cdk
npm run build
```

### Linting

```bash
# Matchmaking (Go)
cd services/matchmaking
make lint

# Game Engine (TypeScript)
cd services/game-engine
npm run lint

# Infrastructure
cd infrastructure/cdk
npm run build  # TypeScript compiler checks
```

## CI/CD

GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`): Runs on all PRs
  - Lints and tests all services
  - Builds Docker images
  - Synths CDK infrastructure

- **Deploy Dev** (`.github/workflows/deploy-dev.yml`): Deploys to development
  - Triggered on push to `develop`
  - Builds and pushes to ECR
  - Updates ECS services

- **Deploy Prod** (`.github/workflows/deploy-prod.yml`): Deploys to production
  - Triggered on push to `main` or version tags
  - Rolling update strategy
  - Smoke tests

## Monitoring & Observability

- **Logs**: CloudWatch Logs for all services
- **Metrics**: CloudWatch metrics (ECS, ALB, DynamoDB, Redis)
- **Tracing**: (Future) AWS X-Ray, OpenTelemetry
- **Dashboards**: (Future) CloudWatch + Grafana
- **Alerting**: (Future) CloudWatch Alarms + PagerDuty

## Security

- **Authentication**: (Future) Cognito User Pools, JWT validation
- **Network**: Private subnets, security groups, VPC endpoints
- **Encryption**: At rest (KMS), in transit (TLS)
- **Secrets**: (Future) AWS Secrets Manager
- **IAM**: Least-privilege roles per service
- **Scanning**: ECR image scanning enabled

## Cost Optimization

- **Development**: Single NAT Gateway, t3.micro instances, minimal capacity
- **Production**: Fargate Savings Plans, Reserved Capacity, auto-scaling
- **General**: VPC endpoints, S3 lifecycle policies, DynamoDB on-demand, log retention policies

Estimated costs:
- **Dev**: ~$100-150/month
- **Prod** (low traffic): ~$300-500/month
- **Prod** (high traffic): Variable based on usage

## Performance

Target SLAs:
- **Availability**: 99.9%
- **API Latency**: < 200ms (p99)
- **WebSocket Latency**: < 50ms (p99)
- **Concurrent Users**: 100K+

## Documentation

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Iterative Roadmap](docs/ROADMAP.md)
- [Matchmaking Service](services/matchmaking/README.md)
- [Game Engine Service](services/game-engine/README.md)
- [Infrastructure (CDK)](infrastructure/cdk/README.md)

## Contributing

This is a demonstration project for AWS Solutions Architect Professional certification. Contributions are welcome but not expected.

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Contact

For questions or feedback about this architecture:
- Open an issue on GitHub
- Reach out to the project maintainer

## Acknowledgments

Built as a demonstration of:
- AWS Solutions Architect Professional expertise
- Microservices architecture best practices
- Event-driven system design
- Real-time application development
- Infrastructure as Code (CDK)
- DevOps and CI/CD practices

## Future Enhancements

See [docs/ROADMAP.md](docs/ROADMAP.md) for planned features:
- Authentication & user management (Phase 2)
- Chat & social features (Phase 3)
- Media streaming & content moderation (Phase 4)
- Payments & analytics (Phase 5)
- Production hardening & optimization (Phase 6)

---

**Built with AWS | Designed for Scale | Ready for Production**
