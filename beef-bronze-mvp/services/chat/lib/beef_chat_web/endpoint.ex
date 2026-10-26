defmodule BeefChatWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :beef_chat

  # Native apps send no Origin header, so origin checks do not apply; the
  # bearer token in the connect params is the authentication.
  socket "/socket", BeefChatWeb.UserSocket,
    websocket: [check_origin: false, timeout: 45_000],
    longpoll: false

  plug Plug.RequestId
  plug Plug.Parsers, parsers: [:json], pass: ["application/json"], json_decoder: Jason
  plug BeefChatWeb.Router
end
