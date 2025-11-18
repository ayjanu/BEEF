package api

import (
	"net/http"

	"github.com/beefmobile/matchmaking/internal/matchmaker"
	"github.com/beefmobile/matchmaking/internal/middleware"
	"github.com/beefmobile/matchmaking/internal/models"
	"github.com/beefmobile/matchmaking/internal/queue"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type MatchmakingHandler struct {
	queueManager *queue.RedisQueueManager
	matchmaker   *matchmaker.Matchmaker
	logger       *zap.SugaredLogger
}

func NewMatchmakingHandler(
	qm *queue.RedisQueueManager,
	mm *matchmaker.Matchmaker,
	logger *zap.SugaredLogger,
) *MatchmakingHandler {
	return &MatchmakingHandler{
		queueManager: qm,
		matchmaker:   mm,
		logger:       logger,
	}
}

// JoinQueue handles POST /matchmaking/queue/join
func (h *MatchmakingHandler) JoinQueue(c *gin.Context) {
	user, err := middleware.GetUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req models.MatchmakingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	entry := models.QueueEntry{
		UserID:   user.ID,
		MMR:      user.MMR,
		Region:   req.Region,
		GameMode: req.GameMode,
	}

	queueID, err := h.queueManager.JoinQueue(c.Request.Context(), entry)
	if err != nil {
		h.logger.Errorw("Failed to join queue", "error", err, "userId", user.ID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join queue"})
		return
	}

	response := models.MatchmakingResponse{
		QueueID:           queueID,
		Position:          1, // Will be updated when checking status
		EstimatedWaitTime: 30,
		Status:            models.StatusQueued,
	}

	c.JSON(http.StatusOK, response)
}

// LeaveQueue handles DELETE /matchmaking/queue/leave
func (h *MatchmakingHandler) LeaveQueue(c *gin.Context) {
	user, err := middleware.GetUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.queueManager.LeaveQueue(c.Request.Context(), user.ID); err != nil {
		h.logger.Errorw("Failed to leave queue", "error", err, "userId", user.ID)
		c.JSON(http.StatusNotFound, gin.H{"error": "not in queue"})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetQueueStatus handles GET /matchmaking/queue/status
func (h *MatchmakingHandler) GetQueueStatus(c *gin.Context) {
	user, err := middleware.GetUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	status, err := h.queueManager.GetQueueStatus(c.Request.Context(), user.ID)
	if err != nil {
		h.logger.Errorw("Failed to get queue status", "error", err, "userId", user.ID)
		c.JSON(http.StatusNotFound, gin.H{"error": "not in queue"})
		return
	}

	c.JSON(http.StatusOK, status)
}

// AcceptMatch handles POST /matchmaking/match/:matchId/accept
func (h *MatchmakingHandler) AcceptMatch(c *gin.Context) {
	user, err := middleware.GetUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	matchID := c.Param("matchId")

	if err := h.matchmaker.AcceptMatch(c.Request.Context(), matchID, user.ID); err != nil {
		h.logger.Errorw("Failed to accept match", "error", err, "userId", user.ID, "matchId", matchID)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	match, _ := h.matchmaker.GetMatch(matchID)
	c.JSON(http.StatusOK, match)
}

// DeclineMatch handles POST /matchmaking/match/:matchId/decline
func (h *MatchmakingHandler) DeclineMatch(c *gin.Context) {
	user, err := middleware.GetUserFromContext(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	matchID := c.Param("matchId")

	if err := h.matchmaker.DeclineMatch(c.Request.Context(), matchID, user.ID); err != nil {
		h.logger.Errorw("Failed to decline match", "error", err, "userId", user.ID, "matchId", matchID)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// GetMatch handles GET /matchmaking/match/:matchId
func (h *MatchmakingHandler) GetMatch(c *gin.Context) {
	matchID := c.Param("matchId")

	match, err := h.matchmaker.GetMatch(matchID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "match not found"})
		return
	}

	c.JSON(http.StatusOK, match)
}
