defmodule BeefChat.MixProject do
  use Mix.Project

  def project do
    [
      app: :beef_chat,
      version: "0.1.0",
      elixir: "~> 1.18",
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      releases: [beef_chat: [include_executables_for: [:unix]]]
    ]
  end

  def application do
    [extra_applications: [:logger, :crypto], mod: {BeefChat.Application, []}]
  end

  defp deps do
    [
      {:phoenix, "~> 1.8"},
      {:phoenix_pubsub_redis, "~> 3.0"},
      {:bandit, "~> 1.6"},
      {:jason, "~> 1.4"},
      {:joken, "~> 2.6"},
      {:req, "~> 0.5"}
    ]
  end
end
