defmodule BeefChat.Auth do
  @moduledoc "Verifies ES256 access tokens issued by core-api. Chat holds only the public key."

  def verify(token) when is_binary(token) do
    signer = Joken.Signer.create("ES256", %{"pem" => Application.fetch_env!(:beef_chat, :jwt_public_key)})

    config =
      %{}
      |> Joken.Config.add_claim("iss", nil, &(&1 == "beef-core"))
      |> Joken.Config.add_claim("aud", nil, &(&1 == "beef" or (is_list(&1) and "beef" in &1)))
      |> Joken.Config.add_claim("exp", nil, &(is_integer(&1) and &1 > Joken.current_time()))

    case Joken.verify_and_validate(config, token, signer) do
      {:ok, %{"sub" => sub}} when is_binary(sub) -> {:ok, sub}
      _ -> :error
    end
  rescue
    _ -> :error
  end

  def verify(_), do: :error

  def internal_token_valid?(given) when is_binary(given) do
    expected = Application.fetch_env!(:beef_chat, :internal_token)
    byte_size(given) == byte_size(expected) and Plug.Crypto.secure_compare(given, expected)
  end

  def internal_token_valid?(_), do: false
end
