// Creates the DynamoDB tables in DynamoDB Local with the same keys Terraform
// creates in AWS (infra/terraform/modules/data). Runs as a one-shot compose job.
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-2', endpoint: process.env.DYNAMODB_ENDPOINT });

const tables = [
  {
    TableName: process.env.CHAT_MESSAGES_TABLE,
    KeySchema: [
      { AttributeName: 'thread_id', KeyType: 'HASH' },
      { AttributeName: 'sk', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'thread_id', AttributeType: 'S' },
      { AttributeName: 'sk', AttributeType: 'S' },
    ],
  },
  {
    TableName: process.env.MOVE_LOG_TABLE,
    KeySchema: [{ AttributeName: 'session_id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'session_id', AttributeType: 'S' }],
  },
];

for (const t of tables) {
  try {
    await client.send(new CreateTableCommand({ ...t, BillingMode: 'PAY_PER_REQUEST' }));
    console.log(`created ${t.TableName}`);
  } catch (err) {
    if (err instanceof ResourceInUseException) console.log(`exists ${t.TableName}`);
    else throw err;
  }
}
