.PHONY: help build run test clean docker-build docker-run deps lint

help:
	@echo "Matchmaking Service - Makefile commands:"
	@echo "  make build        - Build the service binary"
	@echo "  make run          - Run the service locally"
	@echo "  make test         - Run tests"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run Docker container"
	@echo "  make deps         - Download dependencies"
	@echo "  make lint         - Run linters"

build:
	@echo "Building matchmaking service..."
	go build -o bin/matchmaking ./cmd/server

run:
	@echo "Running matchmaking service..."
	go run ./cmd/server/main.go

test:
	@echo "Running tests..."
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

clean:
	@echo "Cleaning..."
	rm -rf bin/
	rm -f coverage.out coverage.html

docker-build:
	@echo "Building Docker image..."
	docker build -t beefmobile/matchmaking:latest .

docker-run:
	@echo "Running Docker container..."
	docker run -p 8080:8080 --env-file .env beefmobile/matchmaking:latest

deps:
	@echo "Downloading dependencies..."
	go mod download
	go mod tidy

lint:
	@echo "Running linters..."
	@command -v golangci-lint >/dev/null 2>&1 || { \
		echo "golangci-lint not found. Installing..."; \
		go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest; \
	}
	golangci-lint run

.DEFAULT_GOAL := help
