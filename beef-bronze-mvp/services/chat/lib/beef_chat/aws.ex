defmodule BeefChat.Aws do
  @moduledoc """
  Minimal AWS access for DynamoDB without a heavy SDK: Req signs requests
  with SigV4. Credentials come from, in order:

    1. EKS Pod Identity (AWS_CONTAINER_CREDENTIALS_FULL_URI + token file), in AWS
    2. AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, for local DynamoDB

  Pod Identity credentials are cached until five minutes before they expire.
  """
  @cache_key {__MODULE__, :creds}

  def dynamodb(target, payload) do
    region = Application.fetch_env!(:beef_chat, :aws_region)
    url = Application.get_env(:beef_chat, :dynamodb_endpoint) || "https://dynamodb.#{region}.amazonaws.com"
    creds = credentials()

    sigv4 =
      [access_key_id: creds.access_key_id, secret_access_key: creds.secret_access_key, service: :dynamodb, region: region]
      |> then(fn opts -> if creds.token, do: Keyword.put(opts, :token, creds.token), else: opts end)

    Req.post(url,
      body: Jason.encode!(payload),
      headers: [
        {"content-type", "application/x-amz-json-1.0"},
        {"x-amz-target", "DynamoDB_20120810." <> target}
      ],
      aws_sigv4: sigv4,
      receive_timeout: 3_000,
      retry: :transient,
      max_retries: 2,
      decode_body: false
    )
    |> case do
      {:ok, %{status: 200, body: body}} -> {:ok, Jason.decode!(body)}
      {:ok, %{status: status, body: body}} -> {:error, {status, body}}
      {:error, reason} -> {:error, reason}
    end
  end

  def credentials do
    now = System.system_time(:second)

    case :persistent_term.get(@cache_key, nil) do
      %{expires_at: exp} = c when exp - 300 > now -> c
      _ -> fetch_and_cache()
    end
  end

  defp fetch_and_cache do
    creds =
      case System.get_env("AWS_CONTAINER_CREDENTIALS_FULL_URI") do
        nil ->
          %{
            access_key_id: System.fetch_env!("AWS_ACCESS_KEY_ID"),
            secret_access_key: System.fetch_env!("AWS_SECRET_ACCESS_KEY"),
            token: System.get_env("AWS_SESSION_TOKEN"),
            expires_at: System.system_time(:second) + 3600
          }

        uri ->
          auth = System.fetch_env!("AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE") |> File.read!() |> String.trim()
          %{body: b} = Req.get!(uri, headers: [{"authorization", auth}], receive_timeout: 2_000)
          {:ok, exp, _} = DateTime.from_iso8601(b["Expiration"])

          %{
            access_key_id: b["AccessKeyId"],
            secret_access_key: b["SecretAccessKey"],
            token: b["Token"],
            expires_at: DateTime.to_unix(exp)
          }
      end

    :persistent_term.put(@cache_key, creds)
    creds
  end
end
