package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/beefmobile/matchmaking/internal/api"
	"github.com/beefmobile/matchmaking/internal/config"
	"github.com/beefmobile/matchmaking/internal/matchmaker"
	"github.com/beefmobile/matchmaking/internal/queue"
	"github.com/beefmobile/matchmaking/pkg/events"
	"github.com/beefmobile/matchmaking/pkg/logger"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using environment variables")
	}

	// Initialize configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	log := logger.New(cfg.LogLevel)
	defer log.Sync()

	log.Info("Starting Matchmaking Service",
		"env", cfg.Env,
		"port", cfg.Port,
	)

	// Initialize Redis queue manager
	queueManager, err := queue.NewRedisQueueManager(cfg.Redis, log)
	if err != nil {
		log.Fatal("Failed to create queue manager", "error", err)
	}
	defer queueManager.Close()

	// Initialize AWS SNS event publisher
	eventPublisher, err := events.NewSNSPublisher(cfg.AWS, log)
	if err != nil {
		log.Fatal("Failed to create event publisher", "error", err)
	}

	// Initialize matchmaker
	matchmaker := matchmaker.NewMatchmaker(
		queueManager,
		eventPublisher,
		cfg.Matchmaking,
		log,
	)

	// Start matchmaker background process
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go matchmaker.Start(ctx)

	// Initialize HTTP server
	router := api.NewRouter(queueManager, matchmaker, cfg, log)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	go func() {
		log.Info("HTTP server started", "address", server.Addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("HTTP server error", "error", err)
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	// Give outstanding requests 5 seconds to complete
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Error("Server forced to shutdown", "error", err)
	}

	log.Info("Server exited")
}
