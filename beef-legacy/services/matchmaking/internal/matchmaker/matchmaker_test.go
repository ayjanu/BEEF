package matchmaker

import (
	"testing"
	"time"

	"github.com/beefmobile/matchmaking/internal/models"
)

func TestIsCompatible(t *testing.T) {
	m := &Matchmaker{
		config: config.MatchmakingConfig{
			MMRTolerance: 100,
		},
	}

	tests := []struct {
		name       string
		player1    models.QueueEntry
		player2    models.QueueEntry
		compatible bool
	}{
		{
			name: "players within tolerance",
			player1: models.QueueEntry{
				UserID: "user1",
				MMR:    1000,
			},
			player2: models.QueueEntry{
				UserID: "user2",
				MMR:    1050,
			},
			compatible: true,
		},
		{
			name: "players exactly at tolerance",
			player1: models.QueueEntry{
				UserID: "user1",
				MMR:    1000,
			},
			player2: models.QueueEntry{
				UserID: "user2",
				MMR:    1100,
			},
			compatible: true,
		},
		{
			name: "players outside tolerance",
			player1: models.QueueEntry{
				UserID: "user1",
				MMR:    1000,
			},
			player2: models.QueueEntry{
				UserID: "user2",
				MMR:    1150,
			},
			compatible: false,
		},
		{
			name: "same MMR",
			player1: models.QueueEntry{
				UserID: "user1",
				MMR:    1000,
			},
			player2: models.QueueEntry{
				UserID: "user2",
				MMR:    1000,
			},
			compatible: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := m.isCompatible(tt.player1, tt.player2)
			if result != tt.compatible {
				t.Errorf("isCompatible() = %v, want %v", result, tt.compatible)
			}
		})
	}
}

func TestGetRequiredPlayers(t *testing.T) {
	m := &Matchmaker{}

	tests := []struct {
		name     string
		gameMode models.GameMode
		expected int
	}{
		{"Quickplay 1v1", models.Quickplay1v1, 2},
		{"Ranked 1v1", models.Ranked1v1, 2},
		{"Quickplay 2v2", models.Quickplay2v2, 4},
		{"Ranked 2v2", models.Ranked2v2, 4},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := m.getRequiredPlayers(tt.gameMode)
			if result != tt.expected {
				t.Errorf("getRequiredPlayers(%v) = %v, want %v", tt.gameMode, result, tt.expected)
			}
		})
	}
}

func TestSortByQueueTime(t *testing.T) {
	now := time.Now()

	players := []models.QueueEntry{
		{UserID: "user3", QueuedAt: now.Add(30 * time.Second)},
		{UserID: "user1", QueuedAt: now},
		{UserID: "user2", QueuedAt: now.Add(10 * time.Second)},
	}

	sortByQueueTime(players)

	// Should be sorted oldest first
	if players[0].UserID != "user1" {
		t.Errorf("First player should be user1, got %s", players[0].UserID)
	}
	if players[1].UserID != "user2" {
		t.Errorf("Second player should be user2, got %s", players[1].UserID)
	}
	if players[2].UserID != "user3" {
		t.Errorf("Third player should be user3, got %s", players[2].UserID)
	}
}

func TestBuildMatch(t *testing.T) {
	m := &Matchmaker{
		config: config.MatchmakingConfig{
			AcceptTimeoutSeconds: 30,
		},
	}

	entries := []models.QueueEntry{
		{UserID: "user1", MMR: 1000, Region: models.NAEast, GameMode: models.Ranked1v1},
		{UserID: "user2", MMR: 1050, Region: models.NAEast, GameMode: models.Ranked1v1},
	}

	match := m.buildMatch(entries)

	// Verify match properties
	if match.MatchID == "" {
		t.Error("Match ID should not be empty")
	}

	if len(match.Players) != 2 {
		t.Errorf("Expected 2 players, got %d", len(match.Players))
	}

	if match.Region != models.NAEast {
		t.Errorf("Expected region %s, got %s", models.NAEast, match.Region)
	}

	if match.GameMode != models.Ranked1v1 {
		t.Errorf("Expected game mode %s, got %s", models.Ranked1v1, match.GameMode)
	}

	if match.Status != models.MatchPendingAcceptance {
		t.Errorf("Expected status %s, got %s", models.MatchPendingAcceptance, match.Status)
	}

	// Verify players are not accepted initially
	for _, player := range match.Players {
		if player.Accepted {
			t.Error("Players should not be accepted initially")
		}
	}

	// Verify expiration time
	expectedExpiry := time.Now().Add(30 * time.Second)
	if match.ExpiresAt.Before(expectedExpiry.Add(-1*time.Second)) || match.ExpiresAt.After(expectedExpiry.Add(1*time.Second)) {
		t.Error("Match expiry time is not set correctly")
	}
}

func TestAbs(t *testing.T) {
	tests := []struct {
		input    int
		expected int
	}{
		{5, 5},
		{-5, 5},
		{0, 0},
		{100, 100},
		{-100, 100},
	}

	for _, tt := range tests {
		result := abs(tt.input)
		if result != tt.expected {
			t.Errorf("abs(%d) = %d, want %d", tt.input, result, tt.expected)
		}
	}
}

func TestRemoveMatchedPlayers(t *testing.T) {
	all := []models.QueueEntry{
		{UserID: "user1"},
		{UserID: "user2"},
		{UserID: "user3"},
		{UserID: "user4"},
	}

	matched := []models.QueueEntry{
		{UserID: "user2"},
		{UserID: "user4"},
	}

	result := removeMatchedPlayers(all, matched)

	if len(result) != 2 {
		t.Errorf("Expected 2 remaining players, got %d", len(result))
	}

	// Verify correct players remain
	if result[0].UserID != "user1" || result[1].UserID != "user3" {
		t.Error("Wrong players remaining after removal")
	}
}
