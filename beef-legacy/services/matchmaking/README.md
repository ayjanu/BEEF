# Matchmaking Service

Real-time matchmaking service built in Go for Beefmobile gaming platform. Provides skill-based matchmaking using MMR (Matchmaking Rating) with region partitioning and queue management.

## Features

- **Skill-Based Matchmaking**: MMR-based pairing with configurable tolerance
- **Region Partitioning**: Separate queues per geographic region for low latency
- **Multiple Game Modes**: Support for 1v1, 2v2, quickplay, and ranked modes
- **Real-Time Queue Management**: Redis-backed queue with position tracking
- **Event-Driven Architecture**: SNS integration for match events
- **JWT Authentication**: Secure API access with JWT validation
- **Observability**: Structured logging with Zap, ready for metrics

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ HTTP/REST
       ▼
┌─────────────────────────────────────┐
│      API Gateway (Gin)              │
│  ┌──────────┐    ┌──────────────┐  │
│  │  Auth    │    │   Handlers   │  │
│  │Middleware│───▶│ (Join/Leave) │  │
│  └──────────┘    └──────┬───────┘  │
└──────────────────────────┼──────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Redis     │    │ Matchmaker  │    │ SNS Publisher│
│   Queue     │◀───│   Engine    │───▶│   (Events)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Prerequisites

- Go 1.21+
- Redis 6.0+
- AWS Account (for SNS)
- Docker (optional)

## Quick Start

### Local Development

1. **Clone and navigate to service directory**:
   ```bash
   cd services/matchmaking
   ```

2. **Copy environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies**:
   ```bash
   make deps
   ```

4. **Run Redis (via Docker)**:
   ```bash
   docker run -d -p 6379:6379 redis:7-alpine
   ```

5. **Run the service**:
   ```bash
   make run
   ```

The service will start on `http://localhost:8080`

### Using Docker

```bash
# Build image
make docker-build

# Run container
make docker-run
```

## Configuration

Environment variables (see `.env.example`):

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 8080 |
| `ENV` | Environment (development/production) | development |
| `REDIS_HOST` | Redis hostname | localhost |
| `REDIS_PORT` | Redis port | 6379 |
| `REDIS_PASSWORD` | Redis password | "" |
| `AWS_REGION` | AWS region | us-east-1 |
| `AWS_SNS_TOPIC_ARN` | SNS topic ARN for events | "" |
| `JWT_SECRET` | Secret for JWT validation | "" |
| `MATCHMAKING_INTERVAL_SECONDS` | Matchmaker run interval | 2 |
| `MATCHMAKING_MMR_TOLERANCE` | Max MMR difference | 100 |
| `MATCHMAKING_MAX_WAIT_TIME_SECONDS` | Max queue wait time | 120 |
| `MATCHMAKING_ACCEPT_TIMEOUT_SECONDS` | Match accept timeout | 30 |

## API Endpoints

### Health Check
```http
GET /health
```

### Join Queue
```http
POST /v1/matchmaking/queue/join
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "region": "na-east",
  "gameMode": "ranked-1v1"
}
```

**Response**:
```json
{
  "queueId": "uuid",
  "position": 1,
  "estimatedWaitTime": 30,
  "status": "QUEUED"
}
```

### Leave Queue
```http
DELETE /v1/matchmaking/queue/leave
Authorization: Bearer <JWT>
```

### Get Queue Status
```http
GET /v1/matchmaking/queue/status
Authorization: Bearer <JWT>
```

### Accept Match
```http
POST /v1/matchmaking/match/{matchId}/accept
Authorization: Bearer <JWT>
```

### Decline Match
```http
POST /v1/matchmaking/match/{matchId}/decline
Authorization: Bearer <JWT>
```

### Get Match Details
```http
GET /v1/matchmaking/match/{matchId}
Authorization: Bearer <JWT>
```

## Matchmaking Algorithm

1. **Queue Management**: Players are sorted in Redis sorted sets by MMR within their region and game mode
2. **Periodic Processing**: Matchmaker runs every 2 seconds (configurable)
3. **Player Pairing**:
   - Takes oldest player as anchor
   - Finds compatible players within MMR tolerance (±100 by default)
   - Creates match when required players found (2 for 1v1, 4 for 2v2)
4. **Match Creation**:
   - Generates match ID
   - Sets 30-second accept timeout
   - Publishes `MatchFound` event to SNS
   - Removes players from queue
5. **Acceptance Phase**:
   - All players must accept within timeout
   - If all accept → `MatchReady` event published
   - If any decline → Match cancelled, players re-queued

## Events Published (SNS)

### Match Found
```json
{
  "eventId": "uuid",
  "eventType": "matchmaking.match.found",
  "matchId": "uuid",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": {
    "matchId": "uuid",
    "players": [...],
    "region": "na-east",
    "gameMode": "ranked-1v1",
    "status": "PENDING_ACCEPTANCE"
  }
}
```

### Match Ready
```json
{
  "eventId": "uuid",
  "eventType": "matchmaking.match.ready",
  "matchId": "uuid",
  "timestamp": "2024-01-01T00:00:00Z",
  "payload": {
    "matchId": "uuid",
    "players": [...],
    "status": "READY"
  }
}
```

## Testing

```bash
# Run all tests
make test

# Run specific test
go test -v ./internal/matchmaker

# Run with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Project Structure

```
matchmaking/
├── cmd/
│   └── server/
│       └── main.go              # Application entry point
├── internal/
│   ├── api/
│   │   ├── handlers.go          # HTTP handlers
│   │   └── router.go            # Route definitions
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── matchmaker/
│   │   └── matchmaker.go        # Matchmaking algorithm
│   ├── middleware/
│   │   ├── auth.go              # JWT authentication
│   │   ├── cors.go              # CORS middleware
│   │   └── logger.go            # Request logging
│   ├── models/
│   │   └── types.go             # Data models
│   └── queue/
│       └── redis_queue.go       # Redis queue management
├── pkg/
│   ├── events/
│   │   └── sns_publisher.go     # SNS event publishing
│   └── logger/
│       └── logger.go            # Logger initialization
├── Dockerfile                   # Container definition
├── Makefile                     # Build automation
├── go.mod                       # Go dependencies
└── README.md                    # This file
```

## Deployment

### ECS Fargate

This service is designed to run on AWS ECS Fargate. See `infrastructure/cdk` for infrastructure as code.

**Required IAM Permissions**:
- `sns:Publish` for match events
- `elasticache:*` for Redis access (via VPC)

**Environment**:
- VPC with private subnets
- Application Load Balancer
- ElastiCache Redis cluster
- SNS topic for events

### Kubernetes/EKS

Deployment manifests coming soon.

## Monitoring

### Metrics to Track
- Queue depth per region/game mode
- Average wait time
- Match creation rate
- Match acceptance rate
- API latency (p50, p95, p99)

### Logs
Structured JSON logs with fields:
- `level`: info, warn, error
- `timestamp`: ISO8601
- `msg`: Log message
- `userId`, `matchId`, `region`: Context fields

### Health Check
```bash
curl http://localhost:8080/health
```

## Performance Considerations

- **Redis Connection Pooling**: Single Redis client reused across requests
- **Concurrent Queue Processing**: Each region/game mode processed in parallel
- **MMR Indexing**: Redis sorted sets provide O(log N) lookups
- **Stateless Design**: Horizontal scaling ready

## Roadmap

- [ ] Add comprehensive integration tests
- [ ] Implement match expiration cleanup
- [ ] Add Prometheus metrics endpoint
- [ ] Support party/group matchmaking
- [ ] Add skill decay over time
- [ ] Implement backfill for incomplete matches
- [ ] Add rate limiting per user
- [ ] Support WebSocket for real-time queue updates

## Contributing

See main repository [CONTRIBUTING.md](../../CONTRIBUTING.md)

## License

MIT
