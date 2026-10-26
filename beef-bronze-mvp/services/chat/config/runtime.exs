import Config

if config_env() != :test do

# Everything environment-specific is read at boot, so one image runs locally and in AWS.
fetch! = fn name ->
  System.get_env(name) || raise "environment variable #{name} is missing"
end

config :beef_chat, BeefChatWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: String.to_integer(System.get_env("PORT", "4000"))],
  secret_key_base: fetch!.("SECRET_KEY_BASE")

config :beef_chat,
  jwt_public_key: fetch!.("JWT_PUBLIC_KEY") |> String.replace("\\n", "\n"),
  internal_token: fetch!.("INTERNAL_TOKEN"),
  core_api_url: fetch!.("CORE_API_URL"),
  safety_url: fetch!.("SAFETY_URL"),
  redis_url: System.get_env("REDIS_URL"),
  messages_table: System.get_env("CHAT_MESSAGES_TABLE", "beef-dev-chat-messages"),
  aws_region: System.get_env("AWS_REGION", "us-east-2"),
  dynamodb_endpoint: System.get_env("DYNAMODB_ENDPOINT")
end
