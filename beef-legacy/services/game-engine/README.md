# Game Engine Service

Real-time game engine service for Beefmobile platform. Manages game sessions, processes player actions with deterministic logic, and synchronizes state via WebSockets.

## Features

- **Deterministic Game Logic**: Seed-based randomness for replay consistency
- **Real-Time Communication**: WebSocket support via Socket.IO
- **Stateless Workers**: Horizontal scaling ready
- **Event-Driven**: SNS/SQS integration for match lifecycle
- **Action Validation**: Server-authoritative game state
- **Replay System**: All actions logged to DynamoDB
- **Session Management**: Automatic cleanup and timeout handling

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ WebSocket
       ▼
┌─────────────────────────────────────┐
│    Socket.IO Server                 │
│  ┌──────────┐    ┌──────────────┐  │
│  │ Join     │    │ Game Action  │  │
│  │ Session  │───▶│  Processing  │  │
│  └──────────┘    └──────┬───────┘  │
└──────────────────────────┼──────────┘
                           │
       ┌───────────────────┼────────────────────┐
       ▼                   ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ DynamoDB    │    │ Game Logic  │    │ SNS Events  │
│ (Sessions)  │◀───│   Engine    │───▶│ (Lifecycle) │
└─────────────┘    └─────────────┘    └─────────────┘
       │
       ▼
┌─────────────┐
│   S3        │
│ (Replays)   │
└─────────────┘
```

## Prerequisites

- Node.js 18+
- AWS Account
- DynamoDB tables
- S3 bucket
- SNS topic
- SQS queue

## Quick Start

### Local Development

1. **Navigate to service directory**:
   ```bash
   cd services/game-engine
   ```

2. **Install dependencies**:
   ```bash
   make install
   ```

3. **Copy environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your AWS configuration
   ```

4. **Run in development mode**:
   ```bash
   make dev
   ```

The service will start on `http://localhost:8081`

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
| `PORT` | HTTP/WebSocket server port | 8081 |
| `NODE_ENV` | Environment | development |
| `AWS_REGION` | AWS region | us-east-1 |
| `DYNAMODB_GAME_SESSIONS_TABLE` | DynamoDB table for sessions | game-sessions |
| `DYNAMODB_GAME_ACTIONS_TABLE` | DynamoDB table for actions | game-actions |
| `S3_REPLAYS_BUCKET` | S3 bucket for replays | beefmobile-replays |
| `SQS_MATCH_QUEUE_URL` | SQS queue for match events | "" |
| `SNS_GAME_EVENTS_TOPIC_ARN` | SNS topic for game events | "" |
| `GAME_TICK_RATE` | Game update frequency (Hz) | 60 |
| `GAME_MAX_SESSION_DURATION_MINUTES` | Max game length | 60 |

## API Endpoints

### REST API

#### Health Check
```http
GET /health
```

**Response**:
```json
{
  "status": "healthy",
  "service": "game-engine",
  "activeSessions": 42
}
```

#### Get Game Session
```http
GET /v1/game/session/:sessionId
```

#### Submit Action (REST fallback)
```http
POST /v1/game/session/:sessionId/action
Content-Type: application/json

{
  "userId": "user-123",
  "actionType": "MOVE",
  "payload": {
    "from": { "x": 5, "y": 5 },
    "to": { "x": 6, "y": 5 }
  }
}
```

#### End Game Session
```http
POST /v1/game/session/:sessionId/end
Content-Type: application/json

{
  "winnerId": "user-123"
}
```

### WebSocket Events

#### Client → Server

**Join Session**
```javascript
socket.emit('join-session', {
  sessionId: 'session-123',
  userId: 'user-456'
});
```

**Submit Action**
```javascript
socket.emit('game-action', {
  sessionId: 'session-123',
  userId: 'user-456',
  actionType: 'MOVE',
  payload: {
    from: { x: 5, y: 5 },
    to: { x: 6, y: 5 }
  }
});
```

**Leave Session**
```javascript
socket.emit('leave-session', {
  sessionId: 'session-123',
  userId: 'user-456'
});
```

#### Server → Client

**Session Joined**
```javascript
socket.on('session-joined', (data) => {
  console.log('Joined session:', data.sessionId);
});
```

**Game State Update**
```javascript
socket.on('game-state', (state) => {
  // state = { turn, currentPlayerId, boardState, timestamp }
  renderGame(state);
});
```

**Player Connected/Disconnected**
```javascript
socket.on('player-connected', (data) => {
  console.log('Player joined:', data.userId);
});

socket.on('player-disconnected', (data) => {
  console.log('Player left:', data.userId);
});
```

**Error**
```javascript
socket.on('error', (error) => {
  console.error('Error:', error.message);
});
```

## Game Logic

### Deterministic Seeding

Each game session has a unique seed that ensures:
- Reproducible randomness
- Replay capability
- Cheat prevention

```typescript
const rng = seedrandom(session.seed.toString());
const randomValue = rng(); // 0 to 1
```

### Action Validation

All actions are validated server-side:

1. **Turn Validation**: Only current player can act
2. **Action Validity**: Action conforms to game rules
3. **State Consistency**: Action is legal given current state

### State Synchronization

Game state updates are broadcast to all connected players:
- Action processed → New state calculated → Broadcast via WebSocket
- State includes turn number, current player, board state
- Deterministic replay possible from action log

## Events Published (SNS)

### Game Created
```json
{
  "eventType": "game.created",
  "payload": {
    "sessionId": "session-123",
    "matchId": "match-456",
    "players": ["user-1", "user-2"],
    "status": "WAITING_FOR_PLAYERS"
  }
}
```

### Game Started
```json
{
  "eventType": "game.started",
  "payload": {
    "sessionId": "session-123",
    "startedAt": "2024-01-01T00:00:00Z",
    "players": [...]
  }
}
```

### Game Ended
```json
{
  "eventType": "game.ended",
  "payload": {
    "sessionId": "session-123",
    "winnerId": "user-1",
    "result": {
      "duration": 1200,
      "finalScore": { "user-1": 100, "user-2": 75 },
      "mmrChanges": { "user-1": 25, "user-2": -25 }
    }
  }
}
```

## Testing

```bash
# Run tests
make test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Project Structure

```
game-engine/
├── src/
│   ├── api/
│   │   ├── routes.ts              # REST endpoints
│   │   └── websocket.ts           # WebSocket setup
│   ├── consumers/
│   │   └── SQSMatchConsumer.ts    # Match event consumer
│   ├── game/
│   │   ├── GameSessionManager.ts  # Session lifecycle
│   │   └── GameLogic.ts           # Core game rules
│   ├── publishers/
│   │   └── SNSEventPublisher.ts   # Event publishing
│   ├── repositories/
│   │   └── DynamoDBRepository.ts  # Data persistence
│   ├── types/
│   │   └── index.ts               # Type definitions
│   ├── utils/
│   │   └── logger.ts              # Logging setup
│   ├── config.ts                  # Configuration
│   └── index.ts                   # Entry point
├── Dockerfile
├── Makefile
├── package.json
├── tsconfig.json
└── README.md
```

## Deployment

### ECS Fargate

Designed for AWS ECS Fargate deployment.

**Required IAM Permissions**:
- `dynamodb:PutItem`, `dynamodb:GetItem` for sessions/actions tables
- `s3:PutObject` for replay uploads
- `sns:Publish` for game events
- `sqs:ReceiveMessage`, `sqs:DeleteMessage` for match queue

**Environment**:
- VPC with private subnets
- Application/Network Load Balancer (with WebSocket support)
- DynamoDB tables with streams enabled
- SNS/SQS for event processing

## Monitoring

### Metrics to Track
- Active game sessions
- Actions per second
- WebSocket connections
- Average game duration
- Action validation failures

### CloudWatch Logs
Structured JSON logs with:
- `sessionId`, `userId`: Context
- `actionType`: Player action
- `latency`: Processing time

## Performance

- **Horizontal Scaling**: Stateless design, scale ECS tasks
- **WebSocket Pooling**: Socket.IO handles reconnection
- **In-Memory Sessions**: Active sessions cached in memory
- **DynamoDB Streams**: Enable for analytics pipeline

## Roadmap

- [ ] Add comprehensive unit tests for GameLogic
- [ ] Implement spectator mode
- [ ] Add tournament bracket support
- [ ] Implement pause/resume functionality
- [ ] Add AI opponent support
- [ ] Prometheus metrics endpoint
- [ ] Replay download API
- [ ] Rate limiting per user

## License

MIT
