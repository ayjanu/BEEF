import Config

config :beef_chat, BeefChatWeb.Endpoint,
  http: [port: 4002],
  secret_key_base: String.duplicate("t", 64),
  server: false

config :beef_chat,
  jwt_public_key: "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEnotarealkeynotarealkeynotarealkeynotarealkey00000000000000000000000000000000000000==\n-----END PUBLIC KEY-----",
  internal_token: "test-internal-token-123",
  core_api_url: "http://localhost:1",
  safety_url: "http://localhost:1",
  redis_url: nil,
  messages_table: "test",
  aws_region: "us-east-2",
  dynamodb_endpoint: nil
