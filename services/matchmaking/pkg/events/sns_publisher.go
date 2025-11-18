package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	"github.com/aws/aws-sdk-go-v2/service/sns/types"
	"github.com/beefmobile/matchmaking/internal/config"
	"github.com/beefmobile/matchmaking/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

type SNSPublisher struct {
	client   *sns.Client
	topicARN string
	logger   *zap.SugaredLogger
}

func NewSNSPublisher(cfg config.AWSConfig, logger *zap.SugaredLogger) (*SNSPublisher, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.TODO(),
		awsconfig.WithRegion(cfg.Region),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := sns.NewFromConfig(awsCfg)

	logger.Info("SNS Publisher initialized", "topicARN", cfg.SNSTopicARN)

	return &SNSPublisher{
		client:   client,
		topicARN: cfg.SNSTopicARN,
		logger:   logger,
	}, nil
}

// PublishMatchFound publishes a MatchFound event to SNS
func (p *SNSPublisher) PublishMatchFound(ctx context.Context, match *models.Match) error {
	event := Event{
		EventID:   uuid.New().String(),
		EventType: "matchmaking.match.found",
		MatchID:   match.MatchID,
		Timestamp: match.CreatedAt,
		Payload:   match,
	}

	return p.publish(ctx, event)
}

// PublishMatchReady publishes a MatchReady event to SNS
func (p *SNSPublisher) PublishMatchReady(ctx context.Context, match *models.Match) error {
	event := Event{
		EventID:   uuid.New().String(),
		EventType: "matchmaking.match.ready",
		MatchID:   match.MatchID,
		Timestamp: match.CreatedAt,
		Payload:   match,
	}

	return p.publish(ctx, event)
}

// publish sends an event to SNS
func (p *SNSPublisher) publish(ctx context.Context, event Event) error {
	message, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	input := &sns.PublishInput{
		TopicArn: aws.String(p.topicARN),
		Message:  aws.String(string(message)),
		MessageAttributes: map[string]types.MessageAttributeValue{
			"eventType": {
				DataType:    aws.String("String"),
				StringValue: aws.String(event.EventType),
			},
			"matchId": {
				DataType:    aws.String("String"),
				StringValue: aws.String(event.MatchID),
			},
		},
	}

	output, err := p.client.Publish(ctx, input)
	if err != nil {
		return fmt.Errorf("failed to publish to SNS: %w", err)
	}

	p.logger.Infow("Event published to SNS",
		"eventType", event.EventType,
		"eventId", event.EventID,
		"messageId", *output.MessageId,
	)

	return nil
}

// Event structure for SNS messages
type Event struct {
	EventID   string      `json:"eventId"`
	EventType string      `json:"eventType"`
	MatchID   string      `json:"matchId,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
	Payload   interface{} `json:"payload"`
}
