import Config

config :beef_chat, BeefChatWeb.Endpoint,
  adapter: Bandit.PhoenixAdapter,
  render_errors: [formats: [json: BeefChatWeb.ErrorJSON], layout: false],
  pubsub_server: BeefChat.PubSub,
  server: true

config :phoenix, :json_library, Jason

config :logger, :default_formatter, format: "$time [$level] $message $metadata\n", metadata: [:request_id]

if File.exists?(Path.join(__DIR__, "#{config_env()}.exs")), do: import_config("#{config_env()}.exs")
