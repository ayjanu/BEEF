package models

import "time"

// GameRegion represents the geographic region
type GameRegion string

const (
	NAEast      GameRegion = "na-east"
	NAWest      GameRegion = "na-west"
	EUWest      GameRegion = "eu-west"
	EUEast      GameRegion = "eu-east"
	AsiaPacific GameRegion = "asia-pacific"
	SAEast      GameRegion = "sa-east"
)

// GameMode represents the game mode type
type GameMode string

const (
	Quickplay1v1 GameMode = "quickplay-1v1"
	Quickplay2v2 GameMode = "quickplay-2v2"
	Ranked1v1    GameMode = "ranked-1v1"
	Ranked2v2    GameMode = "ranked-2v2"
	Custom       GameMode = "custom"
)

// MatchmakingStatus represents queue status
type MatchmakingStatus string

const (
	StatusQueued      MatchmakingStatus = "QUEUED"
	StatusSearching   MatchmakingStatus = "SEARCHING"
	StatusMatchFound  MatchmakingStatus = "MATCH_FOUND"
	StatusAccepted    MatchmakingStatus = "ACCEPTED"
	StatusDeclined    MatchmakingStatus = "DECLINED"
	StatusTimedOut    MatchmakingStatus = "TIMED_OUT"
	StatusCancelled   MatchmakingStatus = "CANCELLED"
)

// MatchStatus represents the match state
type MatchStatus string

const (
	MatchPendingAcceptance MatchStatus = "PENDING_ACCEPTANCE"
	MatchReady             MatchStatus = "READY"
	MatchInProgress        MatchStatus = "IN_PROGRESS"
	MatchCompleted         MatchStatus = "COMPLETED"
	MatchCancelled         MatchStatus = "CANCELLED"
)

// QueueEntry represents a user in the matchmaking queue
type QueueEntry struct {
	UserID   string     `json:"userId"`
	MMR      int        `json:"mmr"`
	Region   GameRegion `json:"region"`
	GameMode GameMode   `json:"gameMode"`
	QueuedAt time.Time  `json:"queuedAt"`
}

// MatchmakingRequest is the request to join a queue
type MatchmakingRequest struct {
	Region   GameRegion `json:"region" binding:"required"`
	GameMode GameMode   `json:"gameMode" binding:"required"`
}

// MatchmakingResponse is the response after joining queue
type MatchmakingResponse struct {
	QueueID           string            `json:"queueId"`
	Position          int               `json:"position"`
	EstimatedWaitTime int               `json:"estimatedWaitTime"` // seconds
	Status            MatchmakingStatus `json:"status"`
}

// Match represents a matched game
type Match struct {
	MatchID   string        `json:"matchId"`
	Players   []MatchPlayer `json:"players"`
	Region    GameRegion    `json:"region"`
	GameMode  GameMode      `json:"gameMode"`
	CreatedAt time.Time     `json:"createdAt"`
	ExpiresAt time.Time     `json:"expiresAt"`
	Status    MatchStatus   `json:"status"`
}

// MatchPlayer represents a player in a match
type MatchPlayer struct {
	UserID   string `json:"userId"`
	MMR      int    `json:"mmr"`
	Accepted bool   `json:"accepted"`
	Team     *int   `json:"team,omitempty"`
}

// User information from JWT
type User struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	MMR      int    `json:"mmr"`
}
