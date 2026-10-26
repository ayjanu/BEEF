defmodule BeefChat.Membership do
  @moduledoc """
  Asks core-api who belongs to a thread, cached in ETS for 60 seconds so a
  busy thread does not call core-api on every join.
  """
  @table :beef_chat_membership
  @ttl_ms 60_000

  def init_cache do
    :ets.new(@table, [:named_table, :public, :set, read_concurrency: true])
    :ok
  end

  def member?(thread_id, user_id) do
    case members(thread_id) do
      {:ok, ids} -> user_id in ids
      _ -> false
    end
  end

  def members(thread_id) do
    now = System.monotonic_time(:millisecond)

    case :ets.lookup(@table, thread_id) do
      [{^thread_id, ids, at}] when now - at < @ttl_ms ->
        {:ok, ids}

      _ ->
        with {:ok, ids} <- fetch(thread_id) do
          :ets.insert(@table, {thread_id, ids, now})
          {:ok, ids}
        end
    end
  end

  defp fetch(thread_id) do
    base = Application.fetch_env!(:beef_chat, :core_api_url)
    token = Application.fetch_env!(:beef_chat, :internal_token)

    case Req.get(base <> "/internal/threads/#{thread_id}/members",
           headers: [{"x-internal-token", token}],
           receive_timeout: 3_000,
           retry: false
         ) do
      {:ok, %{status: 200, body: %{"userIds" => ids}}} -> {:ok, ids}
      {:ok, %{status: status}} -> {:error, status}
      {:error, reason} -> {:error, reason}
    end
  end
end
