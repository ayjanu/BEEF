package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/beefmobile/matchmaking/internal/config"
	"github.com/beefmobile/matchmaking/internal/models"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type RedisQueueManager struct {
	client *redis.Client
	logger *zap.SugaredLogger
}

func NewRedisQueueManager(cfg config.RedisConfig, logger *zap.SugaredLogger) (*RedisQueueManager, error) {
	client := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Password: cfg.Password,
		DB:       cfg.DB,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	logger.Info("Connected to Redis", "host", cfg.Host, "port", cfg.Port)

	return &RedisQueueManager{
		client: client,
		logger: logger,
	}, nil
}

func (m *RedisQueueManager) Close() error {
	return m.client.Close()
}

// JoinQueue adds a user to the matchmaking queue
func (m *RedisQueueManager) JoinQueue(ctx context.Context, entry models.QueueEntry) (string, error) {
	queueID := uuid.New().String()
	entry.QueuedAt = time.Now()

	// Serialize entry
	data, err := json.Marshal(entry)
	if err != nil {
		return "", fmt.Errorf("failed to marshal queue entry: %w", err)
	}

	// Store in sorted set by MMR for the specific region and game mode
	queueKey := m.getQueueKey(entry.Region, entry.GameMode)

	// Add to sorted set (score is MMR)
	if err := m.client.ZAdd(ctx, queueKey, &redis.Z{
		Score:  float64(entry.MMR),
		Member: queueID,
	}).Err(); err != nil {
		return "", fmt.Errorf("failed to add to queue: %w", err)
	}

	// Store full entry data
	dataKey := m.getEntryKey(queueID)
	if err := m.client.Set(ctx, dataKey, data, 5*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("failed to store entry data: %w", err)
	}

	// Store user-to-queue mapping
	userQueueKey := m.getUserQueueKey(entry.UserID)
	if err := m.client.Set(ctx, userQueueKey, queueID, 5*time.Minute).Err(); err != nil {
		return "", fmt.Errorf("failed to store user queue mapping: %w", err)
	}

	m.logger.Infow("User joined queue",
		"userId", entry.UserID,
		"queueId", queueID,
		"mmr", entry.MMR,
		"region", entry.Region,
		"gameMode", entry.GameMode,
	)

	return queueID, nil
}

// LeaveQueue removes a user from the queue
func (m *RedisQueueManager) LeaveQueue(ctx context.Context, userID string) error {
	// Get queue ID from user mapping
	userQueueKey := m.getUserQueueKey(userID)
	queueID, err := m.client.Get(ctx, userQueueKey).Result()
	if err == redis.Nil {
		return fmt.Errorf("user not in queue")
	} else if err != nil {
		return fmt.Errorf("failed to get queue ID: %w", err)
	}

	// Get entry to find queue key
	entry, err := m.GetEntry(ctx, queueID)
	if err != nil {
		return err
	}

	queueKey := m.getQueueKey(entry.Region, entry.GameMode)

	// Remove from sorted set
	if err := m.client.ZRem(ctx, queueKey, queueID).Err(); err != nil {
		return fmt.Errorf("failed to remove from queue: %w", err)
	}

	// Delete entry data
	dataKey := m.getEntryKey(queueID)
	if err := m.client.Del(ctx, dataKey, userQueueKey).Err(); err != nil {
		return fmt.Errorf("failed to delete entry data: %w", err)
	}

	m.logger.Infow("User left queue",
		"userId", userID,
		"queueId", queueID,
	)

	return nil
}

// GetQueueStatus returns the user's position and estimated wait time
func (m *RedisQueueManager) GetQueueStatus(ctx context.Context, userID string) (*models.MatchmakingResponse, error) {
	// Get queue ID
	userQueueKey := m.getUserQueueKey(userID)
	queueID, err := m.client.Get(ctx, userQueueKey).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("user not in queue")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get queue ID: %w", err)
	}

	// Get entry
	entry, err := m.GetEntry(ctx, queueID)
	if err != nil {
		return nil, err
	}

	queueKey := m.getQueueKey(entry.Region, entry.GameMode)

	// Get position in queue
	rank, err := m.client.ZRank(ctx, queueKey, queueID).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get queue rank: %w", err)
	}

	// Estimate wait time (2 seconds per match, assuming pairs)
	estimatedWaitTime := int(rank) * 2

	return &models.MatchmakingResponse{
		QueueID:           queueID,
		Position:          int(rank) + 1,
		EstimatedWaitTime: estimatedWaitTime,
		Status:            models.StatusQueued,
	}, nil
}

// GetEntry retrieves a queue entry by ID
func (m *RedisQueueManager) GetEntry(ctx context.Context, queueID string) (*models.QueueEntry, error) {
	dataKey := m.getEntryKey(queueID)
	data, err := m.client.Get(ctx, dataKey).Result()
	if err == redis.Nil {
		return nil, fmt.Errorf("queue entry not found")
	} else if err != nil {
		return nil, fmt.Errorf("failed to get entry: %w", err)
	}

	var entry models.QueueEntry
	if err := json.Unmarshal([]byte(data), &entry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entry: %w", err)
	}

	return &entry, nil
}

// GetQueuedPlayers returns all players in queue for a region and game mode
func (m *RedisQueueManager) GetQueuedPlayers(ctx context.Context, region models.GameRegion, gameMode models.GameMode) ([]models.QueueEntry, error) {
	queueKey := m.getQueueKey(region, gameMode)

	// Get all queue IDs
	queueIDs, err := m.client.ZRange(ctx, queueKey, 0, -1).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get queue: %w", err)
	}

	entries := make([]models.QueueEntry, 0, len(queueIDs))
	for _, queueID := range queueIDs {
		entry, err := m.GetEntry(ctx, queueID)
		if err != nil {
			m.logger.Warnw("Failed to get entry", "queueId", queueID, "error", err)
			continue
		}
		entries = append(entries, *entry)
	}

	return entries, nil
}

// RemoveEntries removes multiple queue entries (used after matching)
func (m *RedisQueueManager) RemoveEntries(ctx context.Context, queueIDs []string) error {
	pipe := m.client.Pipeline()

	for _, queueID := range queueIDs {
		// Get entry to find queue key
		entry, err := m.GetEntry(ctx, queueID)
		if err != nil {
			m.logger.Warnw("Failed to get entry for removal", "queueId", queueID, "error", err)
			continue
		}

		queueKey := m.getQueueKey(entry.Region, entry.GameMode)
		dataKey := m.getEntryKey(queueID)
		userQueueKey := m.getUserQueueKey(entry.UserID)

		pipe.ZRem(ctx, queueKey, queueID)
		pipe.Del(ctx, dataKey)
		pipe.Del(ctx, userQueueKey)
	}

	_, err := pipe.Exec(ctx)
	return err
}

// Helper functions for Redis keys
func (m *RedisQueueManager) getQueueKey(region models.GameRegion, gameMode models.GameMode) string {
	return fmt.Sprintf("queue:%s:%s", region, gameMode)
}

func (m *RedisQueueManager) getEntryKey(queueID string) string {
	return fmt.Sprintf("queue:entry:%s", queueID)
}

func (m *RedisQueueManager) getUserQueueKey(userID string) string {
	return fmt.Sprintf("queue:user:%s", userID)
}
