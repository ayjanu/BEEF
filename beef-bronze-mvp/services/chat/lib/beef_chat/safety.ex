defmodule BeefChat.Safety do
  @moduledoc """
  Synchronous pre-delivery text check (Spec 03: under 150 ms, text only).
  If the safety service is unreachable the message is delivered blurred and
  labeled "unscanned" rather than dropped: chat stays up, and the recipient
  is still protected by the interstitial.
  """
  require Logger

  def classify(text) do
    base = Application.fetch_env!(:beef_chat, :safety_url)
    token = Application.fetch_env!(:beef_chat, :internal_token)

    case Req.post(base <> "/v1/classify/text",
           json: %{text: text, context: "chat"},
           headers: [{"x-internal-token", token}],
           receive_timeout: 1_500,
           retry: false
         ) do
      {:ok, %{status: 200, body: %{"action" => action, "labels" => labels}}} ->
        {action, labels}

      other ->
        Logger.warning("safety check unavailable: #{inspect(other)}")
        {"blur", ["unscanned"]}
    end
  end
end
