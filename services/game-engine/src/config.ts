export interface Config {
  port: number;
  env: string;
  aws: {
    region: string;
    gameSessionsTable: string;
    gameActionsTable: string;
    replaysBucket: string;
    sqsMatchQueueUrl: string;
    snsGameEventsTopicArn: string;
  };
  jwt: {
    issuer: string;
    cognitoUserPoolId: string;
    cognitoClientId: string;
  };
  game: {
    tickRate: number;
    maxSessionDurationMinutes: number;
    inactivityTimeoutSeconds: number;
  };
  websocket: {
    pingInterval: number;
    pingTimeout: number;
  };
  logLevel: string;
}

export const config: Config = {
  port: parseInt(process.env.PORT || '8081', 10),
  env: process.env.NODE_ENV || 'development',
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    gameSessionsTable: process.env.DYNAMODB_GAME_SESSIONS_TABLE || 'game-sessions',
    gameActionsTable: process.env.DYNAMODB_GAME_ACTIONS_TABLE || 'game-actions',
    replaysBucket: process.env.S3_REPLAYS_BUCKET || 'beefmobile-replays',
    sqsMatchQueueUrl: process.env.SQS_MATCH_QUEUE_URL || '',
    snsGameEventsTopicArn: process.env.SNS_GAME_EVENTS_TOPIC_ARN || '',
  },
  jwt: {
    issuer: process.env.JWT_ISSUER || 'beefmobile-auth',
    cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID || '',
    cognitoClientId: process.env.COGNITO_CLIENT_ID || '',
  },
  game: {
    tickRate: parseInt(process.env.GAME_TICK_RATE || '60', 10),
    maxSessionDurationMinutes: parseInt(process.env.GAME_MAX_SESSION_DURATION_MINUTES || '60', 10),
    inactivityTimeoutSeconds: parseInt(process.env.GAME_INACTIVITY_TIMEOUT_SECONDS || '300', 10),
  },
  websocket: {
    pingInterval: parseInt(process.env.WS_PING_INTERVAL || '30000', 10),
    pingTimeout: parseInt(process.env.WS_PING_TIMEOUT || '5000', 10),
  },
  logLevel: process.env.LOG_LEVEL || 'info',
};
