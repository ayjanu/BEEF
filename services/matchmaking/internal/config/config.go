package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Env        string
	Port       int
	Redis      RedisConfig
	AWS        AWSConfig
	JWT        JWTConfig
	Matchmaking MatchmakingConfig
	LogLevel   string
}

type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

type AWSConfig struct {
	Region      string
	SNSTopicARN string
}

type JWTConfig struct {
	Secret string
	Issuer string
}

type MatchmakingConfig struct {
	IntervalSeconds      int
	MMRTolerance         int
	MaxWaitTimeSeconds   int
	AcceptTimeoutSeconds int
}

func Load() (*Config, error) {
	port, err := strconv.Atoi(getEnv("PORT", "8080"))
	if err != nil {
		return nil, fmt.Errorf("invalid PORT: %w", err)
	}

	redisPort, err := strconv.Atoi(getEnv("REDIS_PORT", "6379"))
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_PORT: %w", err)
	}

	redisDB, err := strconv.Atoi(getEnv("REDIS_DB", "0"))
	if err != nil {
		return nil, fmt.Errorf("invalid REDIS_DB: %w", err)
	}

	intervalSeconds, err := strconv.Atoi(getEnv("MATCHMAKING_INTERVAL_SECONDS", "2"))
	if err != nil {
		return nil, fmt.Errorf("invalid MATCHMAKING_INTERVAL_SECONDS: %w", err)
	}

	mmrTolerance, err := strconv.Atoi(getEnv("MATCHMAKING_MMR_TOLERANCE", "100"))
	if err != nil {
		return nil, fmt.Errorf("invalid MATCHMAKING_MMR_TOLERANCE: %w", err)
	}

	maxWaitTime, err := strconv.Atoi(getEnv("MATCHMAKING_MAX_WAIT_TIME_SECONDS", "120"))
	if err != nil {
		return nil, fmt.Errorf("invalid MATCHMAKING_MAX_WAIT_TIME_SECONDS: %w", err)
	}

	acceptTimeout, err := strconv.Atoi(getEnv("MATCHMAKING_ACCEPT_TIMEOUT_SECONDS", "30"))
	if err != nil {
		return nil, fmt.Errorf("invalid MATCHMAKING_ACCEPT_TIMEOUT_SECONDS: %w", err)
	}

	return &Config{
		Env:  getEnv("ENV", "development"),
		Port: port,
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     redisPort,
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       redisDB,
		},
		AWS: AWSConfig{
			Region:      getEnv("AWS_REGION", "us-east-1"),
			SNSTopicARN: getEnv("AWS_SNS_TOPIC_ARN", ""),
		},
		JWT: JWTConfig{
			Secret: getEnv("JWT_SECRET", "development-secret"),
			Issuer: getEnv("JWT_ISSUER", "beefmobile-auth"),
		},
		Matchmaking: MatchmakingConfig{
			IntervalSeconds:      intervalSeconds,
			MMRTolerance:         mmrTolerance,
			MaxWaitTimeSeconds:   maxWaitTime,
			AcceptTimeoutSeconds: acceptTimeout,
		},
		LogLevel: getEnv("LOG_LEVEL", "info"),
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *Config) GetMatchmakingInterval() time.Duration {
	return time.Duration(c.Matchmaking.IntervalSeconds) * time.Second
}

func (c *Config) GetMaxWaitTime() time.Duration {
	return time.Duration(c.Matchmaking.MaxWaitTimeSeconds) * time.Second
}

func (c *Config) GetAcceptTimeout() time.Duration {
	return time.Duration(c.Matchmaking.AcceptTimeoutSeconds) * time.Second
}
