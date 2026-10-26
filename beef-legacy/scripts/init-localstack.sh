#!/bin/bash

# ============================================================================
# LocalStack Initialization Script
# ============================================================================
# This script initializes AWS resources in LocalStack for local development
# Run this after starting docker-compose up
# ============================================================================

set -e

LOCALSTACK_ENDPOINT="http://localhost:4566"
REGION="us-east-1"

echo "🚀 Initializing LocalStack AWS resources..."
echo "Endpoint: $LOCALSTACK_ENDPOINT"
echo "Region: $REGION"
echo ""

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
until curl -s $LOCALSTACK_ENDPOINT/_localstack/health | grep -q '"dynamodb": "running"'; do
    echo "  Waiting for services..."
    sleep 2
done
echo "✅ LocalStack is ready!"
echo ""

# ============================================================================
# SNS Topics
# ============================================================================

echo "📢 Creating SNS Topics..."

# Matchmaking Events Topic
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    sns create-topic \
    --name matchmaking-events \
    --output text > /dev/null
echo "  ✓ matchmaking-events topic created"

# Game Events Topic
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    sns create-topic \
    --name game-events \
    --output text > /dev/null
echo "  ✓ game-events topic created"

echo ""

# ============================================================================
# SQS Queues
# ============================================================================

echo "📬 Creating SQS Queues..."

# Match Queue (receives from matchmaking-events topic)
MATCH_QUEUE_URL=$(aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    sqs create-queue \
    --queue-name match-queue \
    --output text)
echo "  ✓ match-queue created: $MATCH_QUEUE_URL"

# Match Queue DLQ
MATCH_DLQ_URL=$(aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    sqs create-queue \
    --queue-name match-queue-dlq \
    --output text)
echo "  ✓ match-queue-dlq created"

echo ""

# ============================================================================
# SNS to SQS Subscriptions
# ============================================================================

echo "🔗 Creating SNS to SQS Subscriptions..."

# Get queue ARN
MATCH_QUEUE_ARN="arn:aws:sqs:$REGION:000000000000:match-queue"

# Subscribe match-queue to matchmaking-events topic
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    sns subscribe \
    --topic-arn "arn:aws:sns:$REGION:000000000000:matchmaking-events" \
    --protocol sqs \
    --notification-endpoint "$MATCH_QUEUE_ARN" \
    --output text > /dev/null
echo "  ✓ Subscribed match-queue to matchmaking-events"

echo ""

# ============================================================================
# DynamoDB Tables
# ============================================================================

echo "🗄️  Creating DynamoDB Tables..."

# Game Sessions Table
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    dynamodb create-table \
    --table-name game-sessions-dev \
    --attribute-definitions \
        AttributeName=sessionId,AttributeType=S \
        AttributeName=matchId,AttributeType=S \
        AttributeName=status,AttributeType=S \
        AttributeName=startedAt,AttributeType=N \
    --key-schema \
        AttributeName=sessionId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"matchId-index\",
                \"KeySchema\": [{\"AttributeName\":\"matchId\",\"KeyType\":\"HASH\"}],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            },
            {
                \"IndexName\": \"status-startedAt-index\",
                \"KeySchema\": [
                    {\"AttributeName\":\"status\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"startedAt\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
    --output text > /dev/null
echo "  ✓ game-sessions-dev table created"

# Game Actions Table
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    dynamodb create-table \
    --table-name game-actions-dev \
    --attribute-definitions \
        AttributeName=sessionId,AttributeType=S \
        AttributeName=actionId,AttributeType=S \
        AttributeName=timestamp,AttributeType=N \
    --key-schema \
        AttributeName=sessionId,KeyType=HASH \
        AttributeName=actionId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --local-secondary-indexes \
        "[
            {
                \"IndexName\": \"timestamp-index\",
                \"KeySchema\": [
                    {\"AttributeName\":\"sessionId\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"timestamp\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\":\"ALL\"}
            }
        ]" \
    --stream-specification StreamEnabled=true,StreamViewType=NEW_IMAGE \
    --output text > /dev/null
echo "  ✓ game-actions-dev table created"

# Chat Messages Table
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    dynamodb create-table \
    --table-name chat-messages-dev \
    --attribute-definitions \
        AttributeName=conversationId,AttributeType=S \
        AttributeName=messageId,AttributeType=S \
    --key-schema \
        AttributeName=conversationId,KeyType=HASH \
        AttributeName=messageId,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --output text > /dev/null
echo "  ✓ chat-messages-dev table created"

echo ""

# ============================================================================
# S3 Buckets
# ============================================================================

echo "🪣 Creating S3 Buckets..."

# Replays Bucket
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    s3 mb s3://beefmobile-replays-dev
echo "  ✓ beefmobile-replays-dev bucket created"

# Enable versioning
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    s3api put-bucket-versioning \
    --bucket beefmobile-replays-dev \
    --versioning-configuration Status=Enabled
echo "  ✓ Versioning enabled on replays bucket"

# Media Assets Bucket
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    s3 mb s3://beefmobile-media-dev
echo "  ✓ beefmobile-media-dev bucket created"

echo ""

# ============================================================================
# Insert Sample Data (Optional)
# ============================================================================

echo "📝 Inserting Sample Data..."

# Sample user for testing
aws --endpoint-url=$LOCALSTACK_ENDPOINT \
    --region=$REGION \
    dynamodb put-item \
    --table-name game-sessions-dev \
    --item '{
        "sessionId": {"S": "test-session-123"},
        "matchId": {"S": "test-match-456"},
        "gameMode": {"S": "ranked-1v1"},
        "region": {"S": "na-east"},
        "status": {"S": "WAITING_FOR_PLAYERS"},
        "seed": {"N": "123456"},
        "createdAt": {"S": "2024-01-01T00:00:00Z"}
    }' > /dev/null
echo "  ✓ Sample game session inserted"

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "✅ LocalStack initialization complete!"
echo ""
echo "📊 Resources Created:"
echo "  • SNS Topics: matchmaking-events, game-events"
echo "  • SQS Queues: match-queue, match-queue-dlq"
echo "  • DynamoDB Tables: game-sessions-dev, game-actions-dev, chat-messages-dev"
echo "  • S3 Buckets: beefmobile-replays-dev, beefmobile-media-dev"
echo ""
echo "🔗 LocalStack Dashboard: http://localhost:4566/_localstack/health"
echo ""
echo "💡 To verify resources:"
echo "  aws --endpoint-url=http://localhost:4566 dynamodb list-tables"
echo "  aws --endpoint-url=http://localhost:4566 sns list-topics"
echo "  aws --endpoint-url=http://localhost:4566 sqs list-queues"
echo "  aws --endpoint-url=http://localhost:4566 s3 ls"
echo ""
