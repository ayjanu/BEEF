# Testing Guide

Comprehensive testing strategy for the Beefmobile platform.

## Overview

Our testing strategy includes:
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test service interactions
- **End-to-End Tests**: Test complete user workflows
- **Load Tests**: Verify performance under load

## Test Coverage Goals

- **Backend Services**: > 80% coverage
- **Frontend Components**: > 70% coverage
- **Critical Paths**: 100% coverage

## Running Tests

### Matchmaking Service (Go)

```bash
cd services/matchmaking

# Run all tests
make test

# Run with coverage
go test -v -race -coverprofile=coverage.out ./...
go tool cover -html=coverage.out

# Run specific test
go test -v -run TestIsCompatible ./internal/matchmaker

# Run with race detector
go test -race ./...
```

### Game Engine Service (Node.js)

```bash
cd services/game-engine

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode (re-run on changes)
npm run test:watch

# Run specific test file
npm test -- GameLogic.test.ts
```

### Frontend (React)

```bash
cd frontend

# Run tests (to be set up)
npm test

# Run with coverage
npm run test:coverage
```

### Infrastructure (CDK)

```bash
cd infrastructure/cdk

# Validate CDK synthesis
npm run synth

# Run CDK tests (to be added)
npm test
```

## Test Structure

### Unit Tests

Test individual functions in isolation.

**Example: Game Logic Unit Test**

```typescript
// services/game-engine/src/__tests__/GameLogic.test.ts
describe('GameLogic', () => {
  describe('validateAction', () => {
    it('should validate a valid MOVE action', () => {
      const action = createMoveAction(player, from, to);
      const isValid = gameLogic.validateAction(state, action);
      expect(isValid).toBe(true);
    });

    it('should reject invalid MOVE action', () => {
      const action = createInvalidMoveAction(player);
      const isValid = gameLogic.validateAction(state, action);
      expect(isValid).toBe(false);
    });
  });
});
```

**Example: Matchmaking Unit Test (Go)**

```go
// services/matchmaking/internal/matchmaker/matchmaker_test.go
func TestIsCompatible(t *testing.T) {
    tests := []struct {
        name       string
        player1    QueueEntry
        player2    QueueEntry
        compatible bool
    }{
        {
            name:       "players within tolerance",
            player1:    QueueEntry{MMR: 1000},
            player2:    QueueEntry{MMR: 1050},
            compatible: true,
        },
        // ...more test cases
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := m.isCompatible(tt.player1, tt.player2)
            assert.Equal(t, tt.compatible, result)
        })
    }
}
```

### Integration Tests

Test interactions between components.

**Example: API Integration Test**

```typescript
describe('Matchmaking API Integration', () => {
  it('should complete full matchmaking flow', async () => {
    // Join queue
    const response1 = await apiClient.joinQueue({
      region: 'na-east',
      gameMode: 'ranked-1v1',
    });
    expect(response1.success).toBe(true);

    // Check status
    const response2 = await apiClient.getQueueStatus();
    expect(response2.success).toBe(true);
    expect(response2.data.status).toBe('QUEUED');

    // Leave queue
    const response3 = await apiClient.leaveQueue();
    expect(response3.success).toBe(true);
  });
});
```

### End-to-End Tests

Test complete user workflows.

**Example: Game Session E2E Test**

```typescript
describe('Complete Game Session E2E', () => {
  it('should allow two players to complete a game', async () => {
    // 1. Both players join matchmaking
    const player1Queue = await player1.joinQueue();
    const player2Queue = await player2.joinQueue();

    // 2. Wait for match
    await waitFor(() => player1.getMatchFound());

    // 3. Both accept match
    await player1.acceptMatch();
    await player2.acceptMatch();

    // 4. Game session created
    const session = await waitFor(() => player1.getGameSession());

    // 5. Players take turns
    await player1.submitAction('MOVE', { from: [0, 0], to: [1, 0] });
    await player2.submitAction('MOVE', { from: [0, 1], to: [1, 1] });

    // 6. Game completes
    await waitFor(() => session.status === 'COMPLETED');

    // 7. Verify results
    expect(session.winner).toBeDefined();
    expect(session.endedAt).toBeDefined();
  });
});
```

## Load Testing

### Using Artillery

```yaml
# artillery-config.yml
config:
  target: 'http://localhost:8080'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 300
      arrivalRate: 50
      name: Sustained load
scenarios:
  - name: 'Join and leave queue'
    flow:
      - post:
          url: '/v1/matchmaking/queue/join'
          json:
            region: 'na-east'
            gameMode: 'ranked-1v1'
          headers:
            Authorization: 'Bearer {{ token }}'
      - think: 5
      - delete:
          url: '/v1/matchmaking/queue/leave'
          headers:
            Authorization: 'Bearer {{ token }}'
```

```bash
# Run load test
artillery run artillery-config.yml
```

### Using k6

```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  let response = http.post(
    'http://localhost:8080/v1/matchmaking/queue/join',
    JSON.stringify({
      region: 'na-east',
      gameMode: 'ranked-1v1',
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });

  sleep(1);
}
```

```bash
# Run k6 load test
k6 run load-test.js
```

## Continuous Integration

Tests run automatically on every PR via GitHub Actions (`.github/workflows/ci.yml`).

### CI Test Flow

1. **Lint**: Check code style
2. **Unit Tests**: Run all unit tests
3. **Integration Tests**: Test service interactions
4. **Build**: Verify services build successfully
5. **Coverage**: Report test coverage

## Mocking & Test Data

### Mock AWS Services

Use LocalStack for local AWS service mocking:

```bash
# Start LocalStack
docker-compose up -d localstack

# Initialize test data
./scripts/init-localstack.sh
```

### Test Database

Create test-specific database instances:

```typescript
beforeEach(async () => {
  // Create test DynamoDB table
  await createTestTable();
});

afterEach(async () => {
  // Clean up test table
  await deleteTestTable();
});
```

## Test Best Practices

### DO

✅ Write tests first (TDD when possible)
✅ Test edge cases and error paths
✅ Use descriptive test names
✅ Keep tests isolated and independent
✅ Mock external dependencies
✅ Test one thing per test
✅ Use setup/teardown appropriately
✅ Aim for fast test execution

### DON'T

❌ Test implementation details
❌ Write tests that depend on each other
❌ Ignore flaky tests
❌ Test private methods directly
❌ Use real AWS services in tests
❌ Commit commented-out tests
❌ Skipcoverage checks

## Debugging Tests

### Node.js/TypeScript

```bash
# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Then open Chrome DevTools at chrome://inspect
```

### Go

```bash
# Run with verbose output
go test -v ./...

# Debug specific test
dlv test ./internal/matchmaker -- -test.run TestIsCompatible
```

## Code Coverage

### Viewing Coverage Reports

```bash
# Generate and open coverage report
npm run test:coverage
open coverage/index.html
```

### Coverage Badges

Add to README:
```markdown
![Coverage](https://img.shields.io/codecov/c/github/yourusername/beefmobile)
```

## Future Testing Enhancements

- [ ] Add Playwright for E2E frontend tests
- [ ] Set up Storybook for component testing
- [ ] Implement contract testing with Pact
- [ ] Add mutation testing
- [ ] Set up visual regression testing
- [ ] Add accessibility testing (axe-core)
- [ ] Implement chaos engineering tests

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [Go Testing](https://golang.org/pkg/testing/)
- [Artillery](https://artillery.io/)
- [k6 Documentation](https://k6.io/docs/)
- [LocalStack](https://localstack.cloud/)
