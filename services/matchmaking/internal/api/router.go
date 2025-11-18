package api

import (
	"github.com/beefmobile/matchmaking/internal/config"
	"github.com/beefmobile/matchmaking/internal/matchmaker"
	"github.com/beefmobile/matchmaking/internal/middleware"
	"github.com/beefmobile/matchmaking/internal/queue"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

func NewRouter(
	qm *queue.RedisQueueManager,
	mm *matchmaker.Matchmaker,
	cfg *config.Config,
	logger *zap.SugaredLogger,
) *gin.Engine {
	// Set Gin mode based on environment
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(gin.Recovery())
	router.Use(middleware.Logger(logger))
	router.Use(middleware.CORS())

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "healthy",
			"service": "matchmaking",
		})
	})

	// API v1 routes
	v1 := router.Group("/v1")
	{
		// JWT authentication middleware
		auth := middleware.JWTAuth(cfg.JWT)

		// Matchmaking routes
		matchmaking := v1.Group("/matchmaking")
		matchmaking.Use(auth)
		{
			handler := NewMatchmakingHandler(qm, mm, logger)

			matchmaking.POST("/queue/join", handler.JoinQueue)
			matchmaking.DELETE("/queue/leave", handler.LeaveQueue)
			matchmaking.GET("/queue/status", handler.GetQueueStatus)
			matchmaking.POST("/match/:matchId/accept", handler.AcceptMatch)
			matchmaking.POST("/match/:matchId/decline", handler.DeclineMatch)
			matchmaking.GET("/match/:matchId", handler.GetMatch)
		}
	}

	return router
}
