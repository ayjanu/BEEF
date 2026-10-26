defmodule BeefChatWeb.UserSocket do
  use Phoenix.Socket

  channel "user:*", BeefChatWeb.UserChannel
  channel "thread:*", BeefChatWeb.ThreadChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case BeefChat.Auth.verify(token) do
      {:ok, user_id} -> {:ok, assign(socket, :user_id, user_id)}
      :error -> :error
    end
  end

  def connect(_params, _socket, _info), do: :error

  @impl true
  def id(socket), do: "user_socket:#{socket.assigns.user_id}"
end

defmodule BeefChatWeb.UserChannel do
  @moduledoc "A user's private event channel. Only the user themself may join."
  use Phoenix.Channel

  @impl true
  def join("user:" <> user_id, _params, socket) do
    if user_id == socket.assigns.user_id, do: {:ok, socket}, else: {:error, %{reason: "forbidden"}}
  end
end

defmodule BeefChatWeb.ThreadChannel do
  @moduledoc """
  One channel per chat thread. Join is authorized by core-api membership.
  Every message is screened by the safety service before it is stored or
  delivered; "block" never leaves the sender, "blur" is delivered behind an
  interstitial (Spec 01, "Beefs: chat").
  """
  use Phoenix.Channel
  require Logger
  alias BeefChat.{Membership, Messages, Safety}

  @max_len 2000
  @burst 20
  @window_ms 10_000

  @impl true
  def join("thread:" <> thread_id, _params, socket) do
    if Membership.member?(thread_id, socket.assigns.user_id) do
      history =
        case Messages.recent(thread_id) do
          {:ok, msgs} ->
            msgs

          {:error, reason} ->
            Logger.warning("history unavailable: #{inspect(reason)}")
            []
        end

      {:ok, %{messages: history}, assign(socket, thread_id: thread_id, sent: [])}
    else
      {:error, %{reason: "not_a_member"}}
    end
  end

  @impl true
  def handle_in("msg", %{"body" => body}, socket) when is_binary(body) do
    body = String.trim(body)
    now = System.monotonic_time(:millisecond)
    recent = Enum.filter(socket.assigns.sent, &(now - &1 < @window_ms))

    cond do
      body == "" or String.length(body) > @max_len ->
        {:reply, {:error, %{error: "invalid_length"}}, socket}

      length(recent) >= @burst ->
        {:reply, {:error, %{error: "rate_limited"}}, socket}

      true ->
        socket = assign(socket, :sent, [now | recent])

        case Safety.classify(body) do
          {"block", labels} ->
            {:reply, {:error, %{error: "blocked", labels: labels}}, socket}

          {action, labels} ->
            msg = %{
              id: BeefChat.Id.uuid4(),
              thread_id: socket.assigns.thread_id,
              sender_id: socket.assigns.user_id,
              body: body,
              action: action,
              labels: labels,
              sent_at: DateTime.utc_now() |> DateTime.to_iso8601()
            }

            case Messages.put(msg) do
              {:ok, _} ->
                broadcast!(socket, "msg", msg)
                {:reply, {:ok, %{id: msg.id, action: action}}, socket}

              {:error, reason} ->
                Logger.error("message store failed: #{inspect(reason)}")
                {:reply, {:error, %{error: "store_failed"}}, socket}
            end
        end
    end
  end

  def handle_in(_event, _payload, socket), do: {:reply, {:error, %{error: "unknown_event"}}, socket}
end
