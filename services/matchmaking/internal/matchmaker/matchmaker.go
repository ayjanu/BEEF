package matchmaker

import (
	"context"
	"fmt"
	"time"

	"github.com/beefmobile/matchmaking/internal/config"
	"github.com/beefmobile/matchmaking/internal/models"
	"github.com/beefmobile/matchmaking/internal/queue"
	"github.com/beefmobile/matchmaking/pkg/events"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type QueueManager interface {
	GetQueuedPlayers(ctx context.Context, region models.GameRegion, gameMode models.GameMode) ([]models.QueueEntry, error)
	RemoveEntries(ctx context.Context, queueIDs []string) error
}

type EventPublisher interface {
	PublishMatchFound(ctx context.Context, match *models.Match) error
}

type Matchmaker struct {
	queueManager   QueueManager
	eventPublisher EventPublisher
	config         config.MatchmakingConfig
	logger         *zap.SugaredLogger
	matches        map[string]*models.Match // matchID -> Match
}

func NewMatchmaker(
	qm QueueManager,
	ep EventPublisher,
	cfg config.MatchmakingConfig,
	logger *zap.SugaredLogger,
) *Matchmaker {
	return &Matchmaker{
		queueManager:   qm,
		eventPublisher: ep,
		config:         cfg,
		logger:         logger,
		matches:        make(map[string]*models.Match),
	}
}

// Start begins the matchmaking loop
func (m *Matchmaker) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Duration(m.config.IntervalSeconds) * time.Second)
	defer ticker.Stop()

	m.logger.Info("Matchmaker started", "interval", m.config.IntervalSeconds)

	for {
		select {
		case <-ctx.Done():
			m.logger.Info("Matchmaker stopped")
			return
		case <-ticker.C:
			m.runMatchmaking(ctx)
		}
	}
}

// runMatchmaking attempts to create matches from queued players
func (m *Matchmaker) runMatchmaking(ctx context.Context) {
	// All regions to check
	regions := []models.GameRegion{
		models.NAEast,
		models.NAWest,
		models.EUWest,
		models.EUEast,
		models.AsiaPacific,
		models.SAEast,
	}

	// All game modes
	gameModes := []models.GameMode{
		models.Quickplay1v1,
		models.Quickplay2v2,
		models.Ranked1v1,
		models.Ranked2v2,
	}

	// Process each region and game mode
	for _, region := range regions {
		for _, gameMode := range gameModes {
			if err := m.processQueue(ctx, region, gameMode); err != nil {
				m.logger.Errorw("Failed to process queue",
					"region", region,
					"gameMode", gameMode,
					"error", err,
				)
			}
		}
	}
}

// processQueue processes a specific queue
func (m *Matchmaker) processQueue(ctx context.Context, region models.GameRegion, gameMode models.GameMode) error {
	players, err := m.queueManager.GetQueuedPlayers(ctx, region, gameMode)
	if err != nil {
		return fmt.Errorf("failed to get queued players: %w", err)
	}

	if len(players) == 0 {
		return nil
	}

	// Determine required players based on game mode
	requiredPlayers := m.getRequiredPlayers(gameMode)
	if len(players) < requiredPlayers {
		return nil // Not enough players
	}

	// Sort players by wait time (oldest first)
	sortByQueueTime(players)

	// Try to match players
	matches := m.findMatches(players, requiredPlayers)

	// Process each match
	for _, match := range matches {
		if err := m.createMatch(ctx, match); err != nil {
			m.logger.Errorw("Failed to create match", "error", err)
			continue
		}

		// Remove matched players from queue
		queueIDs := make([]string, len(match.Players))
		for i, player := range match.Players {
			queueIDs[i] = player.UserID // Note: This should be queueID, but we'll use UserID for now
		}

		if err := m.queueManager.RemoveEntries(ctx, queueIDs); err != nil {
			m.logger.Errorw("Failed to remove entries from queue", "error", err)
		}
	}

	return nil
}

// findMatches finds compatible matches from the player list
func (m *Matchmaker) findMatches(players []models.QueueEntry, requiredPlayers int) []*models.Match {
	matches := make([]*models.Match, 0)

	for len(players) >= requiredPlayers {
		// Take first player as anchor
		anchor := players[0]
		matchPlayers := []models.QueueEntry{anchor}

		// Find compatible players within MMR tolerance
		for i := 1; i < len(players) && len(matchPlayers) < requiredPlayers; i++ {
			candidate := players[i]

			if m.isCompatible(anchor, candidate) {
				matchPlayers = append(matchPlayers, candidate)
			}
		}

		// If we found enough players, create a match
		if len(matchPlayers) == requiredPlayers {
			match := m.buildMatch(matchPlayers)
			matches = append(matches, match)

			// Remove matched players from the list
			players = removeMatchedPlayers(players, matchPlayers)
		} else {
			// Can't match the anchor, remove them and continue
			players = players[1:]
		}
	}

	return matches
}

// isCompatible checks if two players can be matched
func (m *Matchmaker) isCompatible(p1, p2 models.QueueEntry) bool {
	mmrDiff := abs(p1.MMR - p2.MMR)
	return mmrDiff <= m.config.MMRTolerance
}

// buildMatch creates a Match from queue entries
func (m *Matchmaker) buildMatch(entries []models.QueueEntry) *models.Match {
	matchID := uuid.New().String()
	players := make([]models.MatchPlayer, len(entries))

	for i, entry := range entries {
		players[i] = models.MatchPlayer{
			UserID:   entry.UserID,
			MMR:      entry.MMR,
			Accepted: false,
		}
	}

	match := &models.Match{
		MatchID:   matchID,
		Players:   players,
		Region:    entries[0].Region,
		GameMode:  entries[0].GameMode,
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(time.Duration(m.config.AcceptTimeoutSeconds) * time.Second),
		Status:    models.MatchPendingAcceptance,
	}

	return match
}

// createMatch stores the match and publishes event
func (m *Matchmaker) createMatch(ctx context.Context, match *models.Match) error {
	// Store match
	m.matches[match.MatchID] = match

	// Publish event to SNS
	if err := m.eventPublisher.PublishMatchFound(ctx, match); err != nil {
		return fmt.Errorf("failed to publish match event: %w", err)
	}

	m.logger.Infow("Match created",
		"matchId", match.MatchID,
		"players", len(match.Players),
		"region", match.Region,
		"gameMode", match.GameMode,
	)

	return nil
}

// GetMatch retrieves a match by ID
func (m *Matchmaker) GetMatch(matchID string) (*models.Match, error) {
	match, exists := m.matches[matchID]
	if !exists {
		return nil, fmt.Errorf("match not found")
	}
	return match, nil
}

// AcceptMatch marks a player as accepting the match
func (m *Matchmaker) AcceptMatch(ctx context.Context, matchID, userID string) error {
	match, err := m.GetMatch(matchID)
	if err != nil {
		return err
	}

	// Find player and mark as accepted
	found := false
	for i := range match.Players {
		if match.Players[i].UserID == userID {
			match.Players[i].Accepted = true
			found = true
			break
		}
	}

	if !found {
		return fmt.Errorf("player not in match")
	}

	// Check if all players accepted
	allAccepted := true
	for _, player := range match.Players {
		if !player.Accepted {
			allAccepted = false
			break
		}
	}

	if allAccepted {
		match.Status = models.MatchReady
		m.logger.Infow("Match ready", "matchId", matchID)
		// TODO: Publish MatchReady event
	}

	return nil
}

// DeclineMatch handles a player declining a match
func (m *Matchmaker) DeclineMatch(ctx context.Context, matchID, userID string) error {
	match, err := m.GetMatch(matchID)
	if err != nil {
		return err
	}

	match.Status = models.MatchCancelled
	delete(m.matches, matchID)

	m.logger.Infow("Match declined", "matchId", matchID, "userId", userID)

	// TODO: Re-queue other players

	return nil
}

// Helper functions

func (m *Matchmaker) getRequiredPlayers(gameMode models.GameMode) int {
	switch gameMode {
	case models.Quickplay1v1, models.Ranked1v1:
		return 2
	case models.Quickplay2v2, models.Ranked2v2:
		return 4
	default:
		return 2
	}
}

func sortByQueueTime(players []models.QueueEntry) {
	// Simple bubble sort by QueuedAt (oldest first)
	n := len(players)
	for i := 0; i < n-1; i++ {
		for j := 0; j < n-i-1; j++ {
			if players[j].QueuedAt.After(players[j+1].QueuedAt) {
				players[j], players[j+1] = players[j+1], players[j]
			}
		}
	}
}

func removeMatchedPlayers(all, matched []models.QueueEntry) []models.QueueEntry {
	result := make([]models.QueueEntry, 0)
	matchedIDs := make(map[string]bool)

	for _, m := range matched {
		matchedIDs[m.UserID] = true
	}

	for _, p := range all {
		if !matchedIDs[p.UserID] {
			result = append(result, p)
		}
	}

	return result
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
