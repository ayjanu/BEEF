defmodule BeefChatWeb.Router do
  use Phoenix.Router

  pipeline :internal do
    plug :accepts, ["json"]
    plug BeefChatWeb.InternalAuth
  end

  get "/healthz", BeefChatWeb.HealthController, :live
  get "/readyz", BeefChatWeb.HealthController, :ready

  scope "/internal", BeefChatWeb do
    pipe_through :internal
    post "/notify", NotifyController, :notify
  end
end
