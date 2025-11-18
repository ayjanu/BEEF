.PHONY: help install build dev test clean docker-build docker-run lint

help:
	@echo "Game Engine Service - Makefile commands:"
	@echo "  make install      - Install dependencies"
	@echo "  make build        - Build TypeScript"
	@echo "  make dev          - Run in development mode"
	@echo "  make test         - Run tests"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make docker-build - Build Docker image"
	@echo "  make docker-run   - Run Docker container"
	@echo "  make lint         - Run linter"

install:
	@echo "Installing dependencies..."
	npm install

build:
	@echo "Building TypeScript..."
	npm run build

dev:
	@echo "Starting development server..."
	npm run dev

test:
	@echo "Running tests..."
	npm test

clean:
	@echo "Cleaning..."
	rm -rf dist/
	rm -rf node_modules/
	rm -rf coverage/

docker-build:
	@echo "Building Docker image..."
	docker build -t beefmobile/game-engine:latest .

docker-run:
	@echo "Running Docker container..."
	docker run -p 8081:8081 --env-file .env beefmobile/game-engine:latest

lint:
	@echo "Running linter..."
	npm run lint

.DEFAULT_GOAL := help
