defmodule BeefChatWeb.InternalAuth do
  @moduledoc "Only other BEEF services (holding the internal token) may push notifications."
  import Plug.Conn

  def init(opts), do: opts

  def call(conn, _opts) do
    token = conn |> get_req_header("x-internal-token") |> List.first()

    if BeefChat.Auth.internal_token_valid?(token) do
      conn
    else
      conn |> put_resp_content_type("application/json") |> send_resp(401, ~s({"error":"internal_only"})) |> halt()
    end
  end
end

defmodule BeefChatWeb.HealthController do
  use Phoenix.Controller, formats: [:json]
  def live(conn, _), do: json(conn, %{ok: true})
  def ready(conn, _), do: json(conn, %{ok: true})
end

defmodule BeefChatWeb.NotifyController do
  @moduledoc "core-api pushes realtime events (match found, results...) to users' private channels."
  use Phoenix.Controller, formats: [:json]

  @allowed ~w(mutual_match challenge_received match_found game_result booking_invite booking_update safety_check)

  def notify(conn, %{"userIds" => ids, "event" => event, "payload" => payload})
      when is_list(ids) and event in @allowed do
    Enum.each(ids, &BeefChatWeb.Endpoint.broadcast("user:" <> &1, event, payload))
    json(conn, %{delivered: length(ids)})
  end

  def notify(conn, _), do: conn |> put_status(400) |> json(%{error: "validation_failed"})
end

defmodule BeefChatWeb.ErrorJSON do
  def render(template, _assigns), do: %{error: Phoenix.Controller.status_message_from_template(template)}
end
