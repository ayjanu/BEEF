defmodule BeefChat.Application do
  @moduledoc """
  Chat and presence (Spec 03, "Chat and presence"). Phoenix PubSub uses the
  Redis adapter when REDIS_URL is set, so broadcasts reach sockets on every
  replica behind the load balancer.
  """
  use Application

  @impl true
  def start(_type, _args) do
    BeefChat.Membership.init_cache()

    pubsub =
      case Application.get_env(:beef_chat, :redis_url) do
        nil -> {Phoenix.PubSub, name: BeefChat.PubSub}
        url -> {Phoenix.PubSub, name: BeefChat.PubSub, adapter: Phoenix.PubSub.Redis, url: url, node_name: node_name()}
      end

    children = [pubsub, BeefChatWeb.Endpoint]
    Supervisor.start_link(children, strategy: :one_for_one, name: BeefChat.Supervisor)
  end

  # Each replica needs a unique PubSub node name; the pod hostname is unique in Kubernetes.
  defp node_name do
    {:ok, host} = :inet.gethostname()
    "beef-chat-#{host}-#{System.unique_integer([:positive])}"
  end
end
